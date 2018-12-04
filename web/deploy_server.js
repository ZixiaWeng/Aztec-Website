var express = require('express');
var http = require('http');
var https = require('https');
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var configDB = require('./config/database.js');
var cors = require('cors');
var app = express();
app.use(cors({origin: 'https://aztec.bio'}));
var bodyParser = require('body-parser');
var config = require('./config/app.release.json');
var favicon = require('serve-favicon');
var fs = require('fs');
var multer = require('multer');
var busboy = require('connect-busboy');

mongoose.connect(configDB.url); // connect to our database

//*********************************************************************************
//  init
//*********************************************************************************


var port = config.serverPort;
var sslPort = config.sslPort;

var hskey = fs.readFileSync('security/privateKey.key');
var hscert = fs.readFileSync('security/aztec.bio.crt');

var chainLines = fs.readFileSync('security/aztec.bio.CA.intermediate.crt', 'utf8').split("\n");
var cert = [];
var ca = [];
chainLines.forEach(function(line) {
  cert.push(line);
  if (line.match(/-END CERTIFICATE-/)) {
    ca.push(cert.join("\n"));
    cert = [];
  }
});

var options = {
    key: hskey,
    cert: hscert,
    ca: ca
};


function requireHTTPS(req, res, next) {
    if (!req.secure) {
        //FYI this should work for local development as well
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
}

app.use(requireHTTPS);

app.set('view engine', 'ejs');
app.set('view options', { layout: false });
app.use('/public', express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(favicon(__dirname + '/public/images/bd2k.ico'));
require('./config/passport')(passport); // pass passport for configuration
app.use(busboy());

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser()); // get information from html forms

// required for passport
app.use(session({ secret: 'ilovescotchscotchyscotchscotch' })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

//*********************************************************************************
//  route
//*********************************************************************************
require('./routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

//*********************************************************************************
//  run
//*********************************************************************************

//var port = config.serverPort; // fix it back to config.serverPort before uploading
//app.listen(port);

//console.log("server up and running on port " + port);

http.createServer(app).listen(port);
https.createServer(options, app).listen(sslPort);
console.log("server up and running on port " + port + " and on port " + sslPort);

