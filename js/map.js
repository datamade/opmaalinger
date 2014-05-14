var map;
(function(){
    var lastClicked;
    var boundaries;
    var marker;
    map = L.map('map')
        .fitBounds([[57.955674494979526, 15.710449218749998],[54.28446875235516, 7.470703125]])
        .setZoom(7);
    var googleLayer = new L.Google('ROADMAP', {animate: false});
    map.addLayer(googleLayer);
    map.on('zoomstart', function(e){
        map.removeLayer(boundaries);
        if (typeof marker !== 'undefined'){
            map.removeLayer(marker);
        }
    })
    google.maps.event.addListener(googleLayer._google, 'idle', function(e){
        map.addLayer(boundaries);
        if (typeof marker !== 'undefined'){
            map.addLayer(marker);
        }
    })
    google.maps.event.addListenerOnce(googleLayer._google, 'idle', function(e){
        var district = $.address.parameter('komnr');
        if (district && !address){
            boundaries.eachLayer(function(layer){
                if(layer.feature.properties['komnr'] == district){
                    layer.fire('click');
                }
            })
        }
    })
    var info = L.control({position: 'bottomleft'});
    info.onAdd = function(map){
        this._div = L.DomUtil.create('div', 'info');
        return this._div;
    }

    var map_colors = [
        '#cccccc',
        '#fc9272',
        '#fb6a4a',
        '#de2d26',
        '#a50f15'
    ]

    var jenks_cutoffs = []
    var legend = L.control({position: 'bottomright'});

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

        div.innerHTML = "<div><strong>Companies</strong><br>" + labels.join('<br>') + '</div>';
        return div;
    };

    $.when($.getJSON('data/dk-municipalities.geojson')).then(
        function(shapes){
            var all_values = []
            $.each(shapes.features, function(k, v){
                all_values.push(+v.properties['Hovedtotal']);
            });
            jenks_cutoffs = jenks(all_values, 4);
            jenks_cutoffs[0] = 0; // set the bottom value to 0
            jenks_cutoffs[1] = 1; // set the bottom value to 0
            jenks_cutoffs.pop(); // last item is the max value, so dont use it

            console.log(jenks_cutoffs)
            boundaries = L.geoJson(shapes, {
                style: style,
                onEachFeature: onEachFeature
            }).addTo(map);
            legend.addTo(map);
        }
    );

    $('#search_address').geocomplete()
        .bind('geocode:result', function(event, result){
            if (typeof marker !== 'undefined'){
                map.removeLayer(marker);
            }
            var lat = result.geometry.location.lat();
            var lng = result.geometry.location.lng();
            marker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 17);
            var district = leafletPip.pointInLayer([lng, lat], boundaries);

            $.address.parameter('address', encodeURI($('#search_address').val()));
            district[0].fire('click');
        });

    var address = convertToPlainString($.address.parameter('address'));
    if(address){
        $("#search_address").val(address);
        $('#search_address').geocomplete('find', address)
    }

    function style(feature){
        var style = {
            "color": "white",
            "fillColor": getColor(feature.properties['Hovedtotal']),
            "opacity": 1,
            "weight": 1,
            "fillOpacity": 0.8,
        }
        return style;
    }

    // get color depending on condition_title
    function getColor(d) {
        return  d >= jenks_cutoffs[3] ? map_colors[4] :
                d >= jenks_cutoffs[2] ? map_colors[3] :
                d >= jenks_cutoffs[1] ? map_colors[2] :
                d >  jenks_cutoffs[0] ? map_colors[1] :
                                        map_colors[0];
    }

    function onEachFeature(feature, layer){
        layer.on('click', function(e){
            if(typeof lastClicked !== 'undefined'){
                boundaries.resetStyle(lastClicked);
            }
            e.target.setStyle({'fillColor':"#90BE44"});
            $('#district-info').html(featureInfo(feature.properties));
            map.fitBounds(e.target.getBounds(), {padding: [50,50]});
            lastClicked = e.target;
            $.address.parameter('komnr', feature.properties['komnr'])
        });

        layer.on('mouseover', function(e){
          layer.setStyle({weight: 5})
        });
        layer.on('mouseout', function(e){
          layer.setStyle({weight: 1})
        })

        var labelText = feature.properties['Kommune'] + " kommune<br />" + parseInt(feature.properties['Hovedtotal']) + " companies";
        layer.bindLabel(labelText);
    }
    function featureInfo(properties){
        var district = parseInt(properties['komnr']);
        var blob = "<div>\
            <p>Stuff</p>\
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
})()
