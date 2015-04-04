/*
 * app.js is the main JavaScript code for the website. It includes some generic
 * JavaScript as well as some AngularJS code.
 */

/* 
 * visualization helper functions
 *  (these should be deleted when the page moves to bootstrap)
 */
function show_about(){
    document.getElementById('about_section').style.display="block";
    document.getElementById('website_section').style.display="none";
}

function show_website(){    
    document.getElementById('about_section').style.display="none";
    document.getElementById('website_section').style.display="block";
}

/* 
 * add a repeat(n) method to String objects so we can get a String of 
 * a substring repeated *n* times.
 */
String.prototype.repeat = function(num){
    return new Array( num + 1 ).join( this );
}

/* 
 * add a contains(k) method to Array objects, so we can check if 
 * element *k* exists in a given array.
 */
Array.prototype.contains = function(k) {
    for(var i=0; i < this.length; i++){
        if(this[i] === k){
            return true;
        }
    }
    return false;
}


function isValidHash(str) {
    var l = str.length;
    for (i = 0; i < l; ++i){
        val = str.charCodeAt(i);
        if ((val < 97 && val > 122) && (val < 48 && val > 57)) return false;
    }
    return true;
}


/* 
 * AngularJS app definition
 */
var app = angular.module("app", []);
  
/*
 * add object2Array filter to let us sort Objects from Angular in the 
 * same way we sort Arrays.
 */ 
app.filter('object2Array', function() {
    return function(input) {
        var out = []; 
        for(i in input){
            out.push(input[i]);
        }
        return out;
    }
});

app.controller("AppCtrl", function($http, $scope){
    var app = this;

    // make "all" the default time range choice
    $scope.dateRangeChoice = "all";

    $scope.submitQueryForm = function(){
        var query = $scope.parentQueryText;
        $scope.submitQuery(query);
    }

    $scope.submitQuery = function(query){
        var date_option = $scope.dateRangeChoice;

        var current_time = (new Date()).getTime();
        var min_time = 0;
        
        if (date_option == "year"){
            min_time = current_time - (1000*60*60*24*365);
        }
        else if (date_option == "month"){
            min_time = current_time - (1000*60*60*24*30);
        }
        else if (date_option == "week"){
            min_time = current_time - (1000*60*60*24*7);
        }
        else if (date_option == "day"){
            min_time = current_time - (1000*60*60*24);
        }
 
        var query_string = "";

        if (query != "") {
            if (query.length == 64 && isValidHash(query)){
                // this is a hash query
                queryString = '?q={"filters":[{"and":[{"name":"date","op":">=","val":"' + min_time + '"},{"name":"scripts__hash","op":"any","val":"' + query + '"}]}]}';
            }
            else if (query.slice(-3) == ".js" || query.slice(0, 18) == "inline_script_tag_"){
                // this is a javascript query
                queryString = '?q={"filters":[{"and":[{"name":"date","op":">=","val":"' + min_time + '"},{"name":"scripts__url","op":"any","val":"' + query + '"}]}]}';
            }
            else {
                // this is a webpage query
                /* 
                 * if the last character in the URL is a /, we strip it off because we allow
                 * a single character following the query string to be any character to avoid missing
                 * results from www.google.com/ when the user enters www.google.com & results from 
                 * www.google.com when the user enters www.google.com/
                 */
                if (query.slice(-1) == '/'){
                    query = query.slice(0, -1);
                }
                queryString = '?q={"filters":[{"and":[{"name":"url","op":"like","val":"%' + query + '_"},{"name":"date","op":">=","val":"' + min_time + '"}]}]}';
            }
            //queryString = '?q={"filters":[{"and":[{"or":[{"name":"url","op":"like","val":"%' + query + '_"},{"name":"scripts__url","op":"any","val":"' + query + '"},{"name":"scripts__hash","op":"any","val":"' + query + '"}]},{"name":"date","op":">=","val":"' + min_time + '"}]}]}';
            //queryString = '?q={"filters":[{"name":"url","op":"like","val":"%' + query + '_"}]}';
        }

        $scope.populateData(queryString);
        show_website();
    }

    $scope.populateData = function(queryString){
        $http.get("/api/pageview" + queryString).success(function (data){
            app.records = data.objects;
               
            app.sites = [];
            seen_urls = [];
            already_seen = [];

            for (var i = 0; i < app.records.length; i++){
                var cur_record = app.records[i];

                // TEMPORARY
                if (already_seen.contains(cur_record.url)) continue;
                already_seen.push(cur_record.url);
                // end TEMPORARY

                var to_add = {"url": cur_record.url,
                              "occur": 0,
                              "scripts": {}};
                
                for (var j = i; j < app.records.length; j++){
                    if (app.records[j].url == to_add.url){
                        to_add.occur += 1;
    
                        for (var script_ind = 0; script_ind < app.records[j].scripts.length; script_ind++){
                            var script_url = app.records[j].scripts[script_ind].url;
                            var script_hash = app.records[j].scripts[script_ind].hash;

                            if (!(script_url in to_add.scripts)){
                                to_add.scripts[script_url] = {};
                                to_add.scripts[script_url].url = script_url; // might not be necessary
                                to_add.scripts[script_url].hashes = {};
                                to_add.scripts[script_url].occur = 0;
                            }
                            
                            if (!(script_hash in to_add.scripts[script_url].hashes)){
                                to_add.scripts[script_url].hashes[script_hash] = {};
                                to_add.scripts[script_url].hashes[script_hash].hash = script_hash; // might not be necessary
                                to_add.scripts[script_url].hashes[script_hash].occur = 0;
                            }
                            
                            to_add.scripts[script_url].occur += 1;
                            to_add.scripts[script_url].hashes[script_hash].occur += 1;
                        }
                    }
                }

                // convert hash occur values to percentages
                for (var script_url in to_add.scripts){
                    for (var hash_val in to_add.scripts[script_url].hashes){
                        to_add.scripts[script_url].hashes[hash_val].occur *= (100.0 / to_add.scripts[script_url].occur);
                    }
                    
                    to_add.scripts[script_url].occur *= (100.0 / to_add.occur);
                }

                app.sites.push(to_add);
            }
            
        });
    }
});

