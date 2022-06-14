const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

const exphbs = require('express-handlebars');
const session = require('express-session');
const validator = require('express-validator');
const passport = require('passport');
const flash = require('connect-flash');
const sql = require('mssql');
const bodyParser = require('body-parser');
const MssqlStore = require('mssql-session-store')(session);


// Intializations
const app = express()
require('./lib/passport');

// Settings
app.set('port', process.env.PORT || 4107);
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({
  defaultLayout: 'main',
  layoutsDir: path.join(app.get('views'), 'layouts'),
  partialsDir: path.join(app.get('views'), 'partials'),
  extname: '.hbs',
  helpers: require('./lib/handlebars')
}))
app.set('view engine', '.hbs');

  // Middlewares
  app.use(session({
    secret: 'justasecret',
    resave:true,
    saveUninitialized: true
    //store: new MssqlStore(database)
   }));

app.use(flash());
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({extended: false})); 
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());


// Global variables
app.use((req, res, next) => {
    app.locals.message = req.flash('message');
    app.locals.success = req.flash('success');
    app.locals.user = req.user;
    next();
  });

// Routes
app.use(require('./routes/index'));
app.use(require('./routes/authentication'));
app.use('/links', require('./routes/links'));

// Public
app.use(express.static(path.join(__dirname, 'public')));

const sslServer = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'cert', 'localhost.key')),
  cert: fs.readFileSync(path.join(__dirname, 'cert', 'localhost.cert')),
}, 
app
)

// Starting
sslServer.listen(app.get('port'), () => {
  console.log('Server is in port', app.get('port'));
});




