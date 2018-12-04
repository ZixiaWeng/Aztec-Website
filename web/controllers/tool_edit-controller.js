var util = require('../utility/toolUtils');
var BD2K = require('../utility/bd2k.js');

function Tool_Editor() {
    var self = this;

    self.edit = function(req, res) {
        self._edit(self, req, res);
    };

    self.record_click = function (req, res) {
        self._record(self, req, res);
    };

}

Tool_Editor.prototype._record = function (self, req, res) {
    console.log("Request received");
    var to_insert = req.body;
    if(req.user == undefined){
        to_insert["email"] = "guest";
    }
    else {
        to_insert["email"] = req.user.email;
    }
    console.log(to_insert);
    BD2K.mongo.upsert("user_links",{email:to_insert["email"]},to_insert,function (result) {
        console.log(result);
    });
    return res.status(200).send('OK');
};

function extract_id(originalUrl) {
    //Replace all leading non digits with nothing
    return originalUrl.replace( /^\D+/g, '');
}

Tool_Editor.prototype._edit = function (self, req, res) {
    var id = extract_id(req.originalUrl);
    if (req.user == undefined){
        //Redirect to homepage, user has not logged in yet
        console.log("User is undefined");
        return res.redirect('/');
    }
    BD2K.solr.search({id: id}, function (r) {
        var result = r.response.docs[0];
        if (result == undefined){
            return res.render('tool/message.ejs', {message: "Document does not exist"});
        }
        var owners = result['owners'];
        if (owners == undefined || owners.indexOf(req.user.email) <= -1){
            return res.render('tool/message.ejs', {message: "Permission denied"});
        }
        var data = util.extract2form(result);
        console.log("Form extracted data is "+ JSON.stringify(data));
        return res.render('tool/form.ejs', {title: "Edit",
            heading: "Edit Resource #",
            user: req.user,
            loggedIn : req.isAuthenticated(),
            editURL: "",
            submitFunc: "onEditSubmit()",
            init: "vm.initEdit2("+JSON.stringify(data)+")"
        });
    })
};

module.exports = new Tool_Editor();
