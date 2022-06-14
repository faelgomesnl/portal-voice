const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const bcrypt = require('bcryptjs');

const pool = require('../database');
const helpers = require('./helpers');

passport.use('local.signin', new LocalStrategy({
  usernameField: 'nomeusu',
  passwordField: 'senha',
  passReqToCallback: true
}, async (req, nomeusu, senha, done) => {    
  const rows = await pool.query(`SELECT * FROM sankhya.AD_TBLOGIN WHERE NOMEUSU= '${nomeusu}'`);
  if (rows.recordset.length > 0) {
      const user = rows.recordset[0];      
     
      if (senha == user.SENHA) {
        done(null, user, req.flash('success','Bem Vindo ' + user.NOMEUSU));
      } else {
        done(null, false, req.flash('message', 'Senha Incorreta'));
      } 
  } else {
    return done(null, false, req.flash('message', 'Usuário Não Existe!'));
  } 
}));

//CADASTRAR USUÁRIO/ OS (só adaptar a criação de OS)
passport.use('local.signup', new LocalStrategy({
  usernameField: 'nomeusu',
  passwordField: 'senha',
  passReqToCallback: true
  //recebe os dados 
}, async (req, nomeusu, senha, done) => {
  const { fullname } = req.body;
  const newUser = {
    nomeusu,
    senha,
    fullname
  };
  newUser.senha = await helpers.encryptPassword(senha);
  const result = await pool.query(`INSERT INTO sankhya.AD_TBLOGIN (NOMEUSU, SENHA, fullname) VALUES('${nomeusu}','${senha}','${fullname}')`);
  newUser.id = result.insertId;
  //console.log(result)
  return done(null, newUser);
}));

passport.serializeUser((user, done) => {  
  done(null, user.CODLOGIN);
});

passport.deserializeUser(async (id, done) => {
  
  const rows = await pool.query(`SELECT * FROM sankhya.AD_TBLOGIN WHERE CODLOGIN = ${id}`);
  //console.log(rows)
  done(null, rows.recordset[0]);
});


