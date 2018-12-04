var BD2K = require('../utility/bd2k.js');
var mongo = BD2K.mongo;
var Event = require('../utility/event.js');
var fs = require('fs');
var path = require('path');
var config = require('../config/app.json');
var solr = require('solr-client');

/**
 * @class Resource
 * @constructor
 * @classdesc Resource model: adding, updating, and getting statistics from mongo 
 */
function Resource() {
    var self = this;

    this.onUpdate = function (rows) { return self._onUpdate(self, rows); };
    this.update = function (callback) { return self._update(self, callback); };
    this.stat = function(type, callback) { return self._stat(self, type, callback); };
    this.add = function(json, callback) { return self._add(self, json, callback); };
    this.onAdd = function() { return self._onAdd(self); };

    var crud = new Event();

    this._crud = crud;
    this.crud = crud.register;
}

/**
 * Pulls statistics json files stored in resource_stats collection in mongo.
 * @function
 * @memberof Resource
 * @alias stat
 * @param {String} type - file name
 */
Resource.prototype._stat = function (self, type, callback) {
    var search = {};
    search.type = type;
    mongo.search("resource_stats", search, function(r) {
        callback(r[0].data);
    });

};

/**
 * Updates statistics in mongo. Queries solr for tags, platforms, and sources, then puts results in mongo.
 * @function
 * @memberof Resource
 * @alias update
 */
Resource.prototype._update = function (self, callback) {

    self.crud(callback);

    var options = {};
    options.core = "BD2K";
    options.host = config.solrHost;
    options.port = config.solrPort;
    var client = solr.createClient(options);
    var tagQuery = client.createQuery()
        .q("*")
        .edismax()
        .mm("0%25")
        .groupBy("tags")
        .start(0)
        .rows(1000);
    client.search(tagQuery,function(err,obj){
        if(err){
            console.log("solr" + err);
        }else{
            console.log(obj);

            var stringify = {};
            stringify.name = "tags";
            var minValue = 15;
            var children = [];
            for(var group in obj.grouped.tags.groups){
                if(obj.grouped.tags.groups[group].groupValue !== null && obj.grouped.tags.groups[group].doclist.numFound >= minValue){
                    children.push({name:obj.grouped.tags.groups[group].groupValue, children:[
                        {name:obj.grouped.tags.groups[group].groupValue, size:obj.grouped.tags.groups[group].doclist.numFound}]});
                }
            }
            stringify.children = children;

            var stat = {};
            stat.type = "tags";
            stat.data = stringify;

            var search = {};
            search.type = "tags";

            mongo.upsert("resource_stats", search, stat, function (err) {
                self.tags = true;
                self.onUpdate();
            });
        }
    });

    var platformQuery = client.createQuery()
        .q("*")
        .edismax()
        .mm("0%25")
        .groupBy("platforms")
        .start(0)
        .rows(1000);
    client.search(platformQuery,function(err,obj){
        if(err){
            console.log("solr" + err);
        }else{
            console.log(obj);

            var stringify = {};
            stringify.name = "platforms";
            var minValue = 0;
            var children = [];
            for(var group in obj.grouped.platforms.groups){
                if(obj.grouped.platforms.groups[group].groupValue !== null && obj.grouped.platforms.groups[group].doclist.numFound >= minValue){
                    children.push({name:obj.grouped.platforms.groups[group].groupValue, children:[
                        {name:obj.grouped.platforms.groups[group].groupValue, size:obj.grouped.platforms.groups[group].doclist.numFound}]});
                }
            }
            stringify.children = children;

            var stat = {};
            stat.type = "platforms";
            stat.data = stringify;

            var search = {};
            search.type = "platforms";

            mongo.upsert("resource_stats", search, stat, function (err) {
                self.platforms = true;
                self.onUpdate();
            });
        }
    });

    var sourceQuery = client.createQuery()
        .q("*")
        .edismax()
        .mm("0%25")
        .groupBy("source")
        .start(0)
        .rows(1000);
    client.search(sourceQuery,function(err,obj){
        if(err){
            console.log("solr" + err);
        }else{
            console.log(obj);

            var stringify = [];
            var minValue = 5;
            for(var group in obj.grouped.source.groups){
                if(obj.grouped.source.groups[group].groupValue !== null && obj.grouped.source.groups[group].doclist.numFound >= minValue){
                    var name = "";
                    if(obj.grouped.source.groups[group].groupValue == "submission"){
                        name = "User Submission";
                    }
                    else{
                        name = obj.grouped.source.groups[group].groupValue.charAt(0).toUpperCase() + obj.grouped.source.groups[group].groupValue.slice(1);
                    }
                    stringify.push({domain:{name:name, value:obj.grouped.source.groups[group].doclist.numFound}});
                }
            }

            var stat = {};
            stat.type = "sources";
            stat.data = stringify;

            var search = {};
            search.type = "sources";

            mongo.upsert("resource_stats", search, stat, function (err) {
                self.sources = true;
                self.onUpdate();
            });
        }
    });

    self.onUpdate();
};

Resource.prototype._onUpdate = function(self){
    if(BD2K.has([self.tags, self.platforms, self.sources]))
        self._crud.fire(self);
};

// CURRENTLY UNUSED
// Resource.prototype._add = function (self, json, callback) {
//     self.crud(callback);

//     var insert = JSON.parse(json);
//     if(!insert.id){ //No current ID (New Tool)
//         BD2K.solr.search({id:-1}, function(result, insert){
//             var insertTool = insert[0];
//             var maxID = parseInt(result.response.docs[0].description);
//             insertTool.id = maxID;
//             insertTool.dateCreated = new Date().toISOString();
//             insertTool.dateUpdated = new Date().toISOString();
//             self.id = maxID;

//             BD2K.solr.add(insertTool, function(result){});

//             BD2K.solr.delete("id", "-1", function(obj, maxID){
//                 BD2K.solr.add({"id":-1,"name":"maxID","source":"hidden",description:maxID[0]+1}, function(obj){ self.onAdd(); })
//             }, [maxID]);

//         }, [insert]);
//     }
//     else{ //Already has an ID (tool being edited)
//         self.id = insert.id;
//         insert.dateUpdated = new Date().toISOString();
//         BD2K.solr.delete("id", insert.id, function(obj){
//             BD2K.solr.add(insert, function(result){
//                 self.onAdd();
//             })
//         });
//     }
// };

// //--- onAdd -----------------------------------------------------------------------------
// Resource.prototype._onAdd = function(self){
//     self._crud.fire(self);
// };

//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------

module.exports = Resource;
