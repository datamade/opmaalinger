jQuery.extend( jQuery.fn.dataTableExt.oSort, {
    "datetime-pre": function ( a ) {
        return a.match(/datetime="*([0-9\-\.]+)/)[1];
    },
 
    "datetime-asc": function ( a, b ) {
        return ((a < b) ? -1 : ((a > b) ? 1 : 0));
    },
 
    "datetime-desc": function ( a, b ) {
        return ((a < b) ? 1 : ((a > b) ? -1 : 0));
    },

    "num-html-pre": function ( a ) {
        return parseFloat( a.replace( /<.*?>/g, "" ).replace("$","").replace(",","") );
    },
    
    "num-html-asc": function ( a, b ) {
        return ((a < b) ? -1 : ((a > b) ?  1 : 0));
    },
    
    "num-html-desc": function ( a, b ) {
        return ((a < b) ?  1 : ((a > b) ? -1 : 0));
    },

    "dk-currency-pre": function ( a ) {
        var thing = a.replace( /<.*?>/g, "" ).replace("kr.","").replace(/\./g,"").replace(/,/g,".");
        return parseFloat( thing );
    },
    
    "dk-currency-asc": function ( a, b ) {
        return ((a < b) ? -1 : ((a > b) ?  1 : 0));
    },
    
    "dk-currency-desc": function ( a, b ) {
        return ((a < b) ?  1 : ((a > b) ? -1 : 0));
    }
} );