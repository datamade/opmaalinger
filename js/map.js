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

    var sidebar_table;
    var lastClicked;
    var boundaries;
    var marker;
    var jenks_cutoffs = []
    map = L.map('map', {'scrollWheelZoom': false});
    L.tileLayer('https://{s}.tiles.mapbox.com/v3/datamade.hn83a654/{z}/{x}/{y}.png', {
        attribution: '<a href="http://www.mapbox.com/about/maps/" target="_blank">Terms &amp; Feedback</a>'
    }).addTo(map);

    accounting.settings = {
      currency: {
        symbol : "kr.",   // default currency symbol is '$'
        format: "%v %s", // controls output: %s = symbol, %v = value/number (can be object: see below)
        decimal : ",",  // decimal point separator
        thousand: ".",  // thousands separator
        precision : 2   // decimal places
      },
      number: {
        precision : 0,  // default precision on numbers is 0
        thousand: ".",
        decimal : ","
      }
    }

    var types = [ 'Brolægning',
                  'BYG- Bygge/anlægsarbejde',
                  'DE- Bygge/anlægsarbejde',
                  'Murerarbejdsmænd',
                  'Murersvende',
                  'Tagpap',
                  'Tømrerarbejde',
                  'Hovedtotal'
                ]

    $.when($.getJSON(geojson_file)).then(
      function(shapes){

        // go get the google doc
        $.when(get_google_doc_data(google_doc_id)).then(
          function(csv){

            //company aggregation for each shape from google doc
            constructionCompanies = $.csv.toObjects(csv);

            var all_values = []
            for (var i = 0; i < shapes.features.length; i++) { 
              var stats = get_company_stats_by_municipality(shapes.features[i].properties[geo_id]);
              $.each(types, function(j, t){
                shapes.features[i].properties[t] = stats[t];
              });
              all_values.push(shapes.features[i].properties[color_id]);
            }

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

            var district = $.address.parameter(geo_id);
            if (district){
                boundaries.eachLayer(function(layer){
                    if(layer.feature.properties[geo_id] == district){
                        layer.fire('click');
                    }
                })
            }
            else {
              var kommune_table = "";
              $.each(shapes.features, function(i, f){
                kommune_table += "\
                <tr data-komnr='" + f.properties['komnr'] + "'>\
                  <td>" + f.properties['Kommune'] + "</td>\
                  <td class='bar hovedtotal'><span style='width:100%; background-color: " + getColor(f.properties['Hovedtotal']) + "'><strong>" + f.properties['Hovedtotal'] + "</strong></span></td>\
                </tr>"
              });

              var default_sidebar = "<div>\
                  <table class='table' id ='kommune_table'>\
                    <thead>\
                      <tr>\
                        <th>Kommune</th>\
                        <th>Hovedtotal</th>\
                      </tr>\
                    </thead>\
                    <tbody>" + kommune_table + "</tbody>\
                  </table>\
                  </div>";
              
              $('#district_info').html(default_sidebar);

              setBarWidthByNumber('hovedtotal');
              sidebar_table = $("#kommune_table").dataTable({
                  "aaSorting": [[1, "desc"]],
                  "aoColumns": [
                      null,
                      { "sType": "num-html" }
                  ],
                  "bFilter": false,
                  "bInfo": false,
                  "bPaginate": false,
                  "bAutoWidth": false
              });

              $('#kommune_table tr').click(function(){
                var id = $(this).data('komnr');
                boundaries.eachLayer(function(layer){
                  if(+layer.feature.properties[geo_id] == id)
                    layer.fire('click');
                })
              });
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
        return  d >  jenks_cutoffs[4] ? map_colors[4] :
                d >  jenks_cutoffs[3] ? map_colors[3] :
                d >  jenks_cutoffs[2] ? map_colors[2] :
                d >= jenks_cutoffs[1] ? map_colors[1] :
                                       map_colors[0];
    }

    var legend = L.control({position: 'topright'});

    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend'),
            grades = jenks_cutoffs,
            labels = [],
            from, to;

        labels.push('<i style="background-color:' + getColor(0) + '"></i> 0');
        labels.push('<i style="background-color:' + getColor(1) + '"></i> 1 &ndash; 4');
        for (var i = 2; i < grades.length; i++) {
            from = grades[i] + 1;
            to = grades[i + 1];
            labels.push(
                '<i style="background-color:' + getColor(from + 1) + '"></i> ' +
                from + (to ? '&ndash;' + to : '+'));
        }

        div.innerHTML = "<div><strong>Opmålinger</strong><br>" + labels.join('<br>') + '</div>';
        return div;
    };

    function onEachFeature(feature, layer){
        layer.on('click', function(e){
            if(typeof lastClicked !== 'undefined'){
                boundaries.resetStyle(lastClicked);
            }
            e.target.setStyle({'fillColor': highight_color});
            $('#district_info').html(featureInfo(feature.properties));

            sidebar_table = $("#company_table").dataTable({
                "aaSorting": [[2, "desc"]],
                "aoColumns": [
                    null,
                    null,
                    { "sType": "dk-currency" },
                    { "sType": "dk-currency" },
                    { "sType": "dk-currency" }
                ],
                "bFilter": false,
                "bInfo": false,
                "bPaginate": false,
                "bAutoWidth": false
            });

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

        var labelText = "<h4>" + feature.properties['Kommune'] + " kommune <br />Opmålinger i alt: " + feature.properties['Hovedtotal'] + "</h4>";
        $.each(types, function(j, t){
          if (t != 'Hovedtotal')
            labelText += feature.properties[t] + " " + t + "<br />";
        });

        layer.bindLabel(labelText);
    }
    function featureInfo(properties){
        var companies = get_company_data_by_municipality(properties[geo_id]);

        var company_table = '';
        $.each(companies, function(i, c){
          company_table += "\
          <tr>\
            <td><strong>" + c['Firmanavn'] + "</strong><br />\
            " + c['Byggeplads adresse'] + " " + c['Postnr'] + " " + c['Postby'] + "</td>\
            <td>" + c['Type'] + "</td>\
            <td>" + accounting.formatMoney(c['Samlet beløb']) + "</td>\
            <td>" + accounting.formatNumber(c['Timer']) + "</td>\
            <td>" + accounting.formatMoney(c['Timeløn']) + "</td>\
          </tr>";
        });

        var blob = "<div>\
            <p><a href='index.html'>&laquo; Se hele landet</a></p>\
            <h3>" + properties['Kommune'] + " kommune</h3>\
            <h4>Opmålinger i alt: <strong>" + properties['Hovedtotal'] + "</strong></h4>\
            <table class='table' id ='company_table'>\
              <thead>\
                <tr>\
                  <th>Firmanavn</th>\
                  <th>Type</th>\
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

    function get_company_stats_by_municipality(id){
      
      var stats = {};
      $.each(types, function(k, t){
        stats[t] = 0;
      });

      $.each(constructionCompanies, function(i, c){
        //console.log(obj)
        if (id == +c['Kommunenr'])
          $.each(types, function(j, t){
            if (c['Type'] == t) {
              stats[t] += 1;
              stats['Hovedtotal'] += 1;
            }
          });
      });

      //console.log(stats);
      return stats;
    }
})()
