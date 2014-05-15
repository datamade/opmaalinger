var map;
var constructionCompanies;
(function(){

    //config values
    var geojson_file = 'data/dk-municipalities.geojson';
    var google_doc_id = '0Ak8prRBkmySYdFFyVEwtMXVHV0Rod1RMNVo1b3dEcFE';
    var geo_id = 'komnr';
    var color_id = 'Hovedtotal';
    var map_colors = [
        '#fee5d9',
        '#fc9272',
        '#fb6a4a',
        '#de2d26',
        '#a50f15'
    ];
    var highight_color = "#ffffb2";
    var default_zoom = 7;

    var lastClicked;
    var boundaries;
    var marker;
    var jenks_cutoffs = []
    map = L.map('map');
    L.tileLayer('https://{s}.tiles.mapbox.com/v3/datamade.hn83a654/{z}/{x}/{y}.png', {
        attribution: '<a href="http://www.mapbox.com/about/maps/" target="_blank">Terms &amp; Feedback</a>'
    }).addTo(map);

    $.when($.getJSON(geojson_file)).then(
      function(shapes){
        var all_values = []
        $.each(shapes.features, function(k, v){
            all_values.push(+v.properties[color_id]);
        });
        jenks_cutoffs = jenks(all_values, 4);
        jenks_cutoffs.unshift(0); // set the bottom value to 0
        jenks_cutoffs[1] = 1; // set the bottom value to 0
        jenks_cutoffs.pop(); // last item is the max value, so dont use it

        boundaries = L.geoJson(shapes, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        map.fitBounds([[57.83890342754204, 13.260498046875],[54.15600109028491, 7.163085937499999]]).setZoom(default_zoom);
        legend.addTo(map);

        // go get the google doc
        $.when(get_google_doc_data(google_doc_id)).then(
          function(csv){
            constructionCompanies = $.csv.toObjects(csv);

            var district = $.address.parameter(geo_id);
            if (district){
                boundaries.eachLayer(function(layer){
                    if(layer.feature.properties[geo_id] == district){
                        layer.fire('click');
                    }
                })
            }
        });
      }
    );

    function style(feature){
        var style = {
            "color": "white",
            "fillColor": getColor(feature.properties[color_id]),
            "opacity": 1,
            "weight": 1,
            "fillOpacity": 0.7,
        }
        return style;
    }

    // get color depending on condition_title
    function getColor(d) {
        return  d > jenks_cutoffs[4] ? map_colors[4] :
                d > jenks_cutoffs[3] ? map_colors[3] :
                d > jenks_cutoffs[2] ? map_colors[2] :
                d > jenks_cutoffs[1] ? map_colors[1] :
                                       map_colors[0];
    }

    var legend = L.control({position: 'topright'});

    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend'),
            grades = jenks_cutoffs,
            labels = [],
            from, to;

        labels.push('<i style="background-color:' + getColor(0) + '"></i> 0');
        for (var i = 1; i < grades.length; i++) {
            from = grades[i];
            to = grades[i + 1];
            labels.push(
                '<i style="background-color:' + getColor(from + 0.01) + '"></i> ' +
                from + (to ? '&ndash;' + to : '+'));
        }

        div.innerHTML = "<div><strong>byggefirmaer</strong><br>" + labels.join('<br>') + '</div>';
        return div;
    };

    function onEachFeature(feature, layer){
        layer.on('click', function(e){
            if(typeof lastClicked !== 'undefined'){
                boundaries.resetStyle(lastClicked);
            }
            e.target.setStyle({'fillColor': highight_color});
            $('#district-info').html(featureInfo(feature.properties));
            map.fitBounds(e.target.getBounds(), {padding: [50,50]});
            lastClicked = e.target;
            $.address.parameter(geo_id, feature.properties[geo_id])
        });

        layer.on('mouseover', function(e){
          layer.setStyle({weight: 5})
        });
        layer.on('mouseout', function(e){
          layer.setStyle({weight: 1})
        })

        var labelText = "<h4>" + feature.properties['Kommune'] + " kommune</h4>\
            " + parseInt(feature.properties['Brol__gning']) + " Brol__gning<br />\
            " + parseInt(feature.properties['BYG__Bygge_anl__gsarbejde']) + " BYG__Bygge_anl__gsarbejde<br />\
            " + parseInt(feature.properties['DE__Bygge_anl__gsarbejde']) + " DE__Bygge_anl__gsarbejde<br />\
            " + parseInt(feature.properties['Murerarbejdsm__nd']) + " Murerarbejdsm__nd<br />\
            " + parseInt(feature.properties['Murersvende']) + " Murersvende<br />\
            " + parseInt(feature.properties['Tagpap']) + " Tagpap<br />\
            " + parseInt(feature.properties['T__mrerarbejde']) + " T__mrerarbejde<br />\
            " + parseInt(feature.properties['Hovedtotal']) + " Hovedtotal";
        layer.bindLabel(labelText);
    }
    function featureInfo(properties){
        var companies = get_company_data_by_municipality(properties[geo_id]);

        var company_table = '';
        $.each(companies, function(i, c){
          company_table += "\
          <tr>\
            <td>" + c['Firmanavn'] + "<br />" + c['Type'] + "</td>\
            <td>" + c['Samlet beløb'] + "</td>\
            <td>" + c['Timer'] + "</td>\
            <td>" + c['Timeløn'] + "</td>\
          </tr>"
        });

        var blob = "<div>\
            <h3>" + properties['Kommune'] + " kommune</h3>\
            <table class='table'>\
              <thead>\
                <tr>\
                  <th>Firmanavn</th>\
                  <th>Samlet beløb</th>\
                  <th>Timer</th>\
                  <th>Timeløn</th>\
                </tr>\
              </thead>\
              <tbody>" + company_table + "</tbody>\
            </table>\
            </div>";
        return blob
    }
    function convertToPlainString(text) {
      if (text == undefined) return '';
      return decodeURIComponent(text);
    }

    function addCommas(nStr) {
        nStr += '';
        x = nStr.split('.');
        x1 = x[0];
        x2 = x.length > 1 ? '.' + x[1] : '';
        var rgx = /(\d+)(\d{3})/;
        while (rgx.test(x1)) {
          x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
    }

    function get_google_doc_data(doc_id){
      var doc_url = "https://docs.google.com/spreadsheet/pub?key=" + doc_id + "&output=csv";
      return $.ajax({
          url: doc_url
      });
    }

    function get_company_data_by_municipality(id){
      //console.log('getting companies by ' + id);
      var companies = []
      $.each(constructionCompanies, function(i, obj){
        //console.log(obj)
        if (id == +obj['Kommunenr'])
          companies.push(obj);
      });
      return companies;
    }
})()
