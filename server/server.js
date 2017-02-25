var fs = require('fs');
var extend = require('extend');
var express = require('express');
var bodyParser = require('body-parser');
var Firebase = require("firebase");
var mongodb = require('mongodb');
var mongoose = require('mongoose');
var nodemailer = require("nodemailer");
var smtpTransport = require('nodemailer-smtp-transport');
var crypto = require("crypto");
var compression = require("compression");
var nodeCron = require("node-cron");


const router = express.Router();
const app = express();

// app.use(express.static('../dist'));
app.use(compression());
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // to support URL-encoded bodies
app.use(express.static('./../dist'));
app.use('/elements', express.static('./../dist/elements'));
app.use('/bower_components', express.static('./../dist/bower_components'));
app.use('/fonts', express.static('./../dist/fonts'));
app.use('/images', express.static('./../dist/images'));
app.use('/scripts', express.static('./../dist/scripts'));
app.use('/styles', express.static('./../dist/styles'));
// app.use('/user', express.static('../dist/user'));

// Here we are configuring our SMTP Server details. STMP is mail server which is responsible for sending and recieving email.
var smtpTransport = nodemailer.createTransport("SMTP",
  {
    service: "Gmail",
    auth: {
      user: "v.punzano@gmail.com",
      pass: "*******" // password
    }
  },
  {
    // default values for sendMail method
    from: 'v.punzano@gmail.com'
  }
);

var server = new mongodb.Server("192.168.1.10", 27017, {});

var firebaseRef = new Firebase(//firebase url);

app.post('/registerUser', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  crypto.randomBytes(48, function(err, buffer) {
    if(err){
      console.log('[/saveUser]: ' + err);
      dbConnection.close(); console.log('[/saveUser]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      req.body['verificationToken'] = buffer.toString('hex');
      db.open(function (err, dbConnection) {
        if(err){
          console.log('[/saveUser]: ' + err);
          dbConnection.close(); console.log('[/saveUser]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          console.log('[/saveUser]: Conexion establecida con la BBDD');
          if(req.body.registryType === 'gratuito' || req.body.registryType === 'anual' || req.body.registryType === 'pagoUnico'){
            saveUserInCollection('particulares', dbConnection, req, res);
            sendVerificationEmail(req, res);
          }
          else{
            saveUserInCollection('empresas', dbConnection, req, res);
            sendVerificationEmail(req, res);
          }
        }
      });
    }
  });
});

function saveUserInCollection(collectionName, dbConnection, request, response){
  dbConnection.collection(collectionName, function(err, collection){
    if(err){
      console.log('[/saveUser]: ' + err);
      dbConnection.close(); console.log('[/saveUser]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      console.log('[/saveUser]: El acceso a la colección ha tenido éxito');
      collection.findOne({ $or:[ {email: request.body.email}, {$and:[ {name: request.body.name}, {surname: request.body.surname} ]} ] },
        function(err, doc) {
          if(err){
            console.log('[/saveUser]: ' + err);
            dbConnection.close(); console.log('[/saveUser]: Conexion cerrada con la BBDD');
            res.status(500).end();
          }
          else{
            if(doc != null){
              console.log('[/saveUser]: El usuario ya existía previamente en el sistema');
              dbConnection.close(); console.log('[/saveUser]: Conexion cerrada con la BBDD');
              response.send('Usuario ya registrado').end();
            }
            else{
              console.log('[/saveUser]: El usuario no existía previamente en el sistema');
              var currentDate = new Date(Date.now());
              var userObject = {
                registrationDate: new Date(Date.now()),
                expireAt: new Date(currentDate.setDate(currentDate.getDate() + 2))
              };
              collection.insertOne(extend({}, userObject, request.body));
              dbConnection.close(); console.log('[/saveUser]: Conexion cerrada con la BBDD');
              response.status(200).end();
            }
          }
        }
      );
    }
  });
}

function sendVerificationEmail(request, response){
  var verificationURL;
  var host = request.get('host');
  if(request.body.registryType === 'gratuito' || request.body.registryType === 'anual' || request.body.registryType === 'pagoUnico')
    verificationURL = "http://" + host + "/userVerification/" + request.body.verificationToken;
  else
    verificationURL = "http://" + host + "/companyVerification/" + request.body.verificationToken;
  var mailOptions = {
    to : request.body.email,
    subject : "Mydite: Verificación de email",
    html : "¡Bienvenido/a a Mydite!<br>Está a un sólo paso de completar su registro en nuestro sistema. Basta con que haga click en el siguiente enlace:<br>" +
           "<a href="+ verificationURL + ">¡Verificar correo electrónico!</a><br><br>" +
           "Este enlace expirará en 48h. Si transcurrido ese tiempo no ha hecho click en " +
           "él sus datos serán eliminados de nuestro sistema y deberá volver a realizar el registro."
  }
  smtpTransport.sendMail(mailOptions, function(error, emailResponse){
    if(error){
      console.log('[/saveUser]: ' + error);
      res.status(500).end();
    }
    else console.log('[/saveUser]: ' + 'Message sent: ' + emailResponse.message);
  });
}


app.get('/userVerification/:token', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/userVerification]: ' + err);
      dbConnection.close(); console.log('[/userVerification]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      console.log('[/userVerification]: Conexion establecida con la BBDD');
      dbConnection.collection('particulares',
        function(err, collection){
          if(err){
            console.log('[/userVerification]: ' + err);
            dbConnection.close(); console.log('[/userVerification]: Conexion cerrada con la BBDD');
            res.status(500).end();
          }
          else{
            console.log('[/userVerification]: El acceso a la colección ha tenido éxito');
            collection.findOne({"verificationToken": req.params.token},
              function(err, doc) {
                if(err){
                  console.log('[/userVerification]: ' + err);
                  dbConnection.close(); console.log('[/userVerification]: Conexion cerrada con la BBDD');
                  res.status(500).end();
                }
                else{
                  console.log('[/userVerification]: Usuario encontrado');
                  firebaseRef.createUser({ email: doc.email, password: doc.password },
                    function(error, userData) {
                      if (error) {
                        console.log('[/userVerification]: ' + error);
                        dbConnection.close(); console.log('[/userVerification]: Conexion cerrada con la BBDD');
                        res.status(500).end();
                      } else {
                        console.log('[/userVerification]: Usuario creado en Firebase');
                        console.log(userData);
                        collection.update({"verificationToken": req.params.token}, {$unset: {expireAt: 1}, $set: {firebaseID: userData.uid}},
                          function(err, docs){
                            if(err){
                              console.log('[/userVerification]: ' + err);
                              dbConnection.close(); console.log('[/userVerification]: Conexion cerrada con la BBDD');
                              res.status(500).end();
                            }
                            else{
                              console.log('[/userVerification]: Campo expireAt eliminado');
                              dbConnection.close(); console.log('[/userVerification]: Conexion cerrada con la BBDD');
                              res.redirect('/');
                            }
                          }
                        );
                      }
                    }
                  );
                }
              }
            );
          }
        }
      );
    }
  });
});
app.get('/companyVerification/:token', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/companyVerification]: ' + err);
      dbConnection.close(); console.log('[/companyVerification]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      console.log('[/companyVerification]: Conexion establecida con la BBDD');
      dbConnection.collection('particulares',
        function(err, collection){
          if(err){
            console.log('[/companyVerification]: ' + err);
            dbConnection.close(); console.log('[/companyVerification]: Conexion cerrada con la BBDD');
            res.status(500).end();
          }
          else{
            console.log('[/companyVerification]: El acceso a la colección ha tenido éxito');
            collection.findOne({"verificationToken": req.params.token},
              function(err, doc) {
                if(err){
                  console.log('[/companyVerification]: ' + err);
                  dbConnection.close(); console.log('[/companyVerification]: Conexion cerrada con la BBDD');
                  res.status(500).end();
                }
                else{
                  console.log('[/companyVerification]: Usuario encontrado');
                  firebaseRef.createUser({ email: doc.email, password: doc.password },
                    function(error, userData) {
                      if (error) {
                        console.log('[/companyVerification]: ' + error);
                        dbConnection.close(); console.log('[/companyVerification]: Conexion cerrada con la BBDD');
                        res.status(500).end();
                      } else {
                        console.log('[/companyVerification]: Usuario creado en Firebase');
                        collection.update({"verificationToken": req.params.token}, {$unset: {expireAt: 1}, $set: {firebaseID: userData.uid}},
                          function(err, docs){
                            if(err){
                              console.log('[/companyVerification]: ' + err);
                              dbConnection.close(); console.log('[/companyVerification]: Conexion cerrada con la BBDD');
                              res.status(500).end();
                            }
                            else{
                              console.log('[/companyVerification]: Campo expireAt eliminado y firebaseID introducido'); // EL CAMPO expireAt PODRIA ELIMINARSE Y COMPROBAR SI EXISTE firebaseID
                              dbConnection.close(); console.log('[/companyVerification]: Conexion cerrada con la BBDD');
                              res.redirect('/');
                            }
                          }
                        );
                      }
                    }
                  );
                }
              }
            );
          }
        }
      );
    }
  });
});


app.post('/saveUserConfig', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/saveUserConfig]: ' + err);
      res.status(500).end();
    }
    else{
      console.log('[/saveUserConfig]: Conexion establecida con la BBDD.');
      dbConnection.collection('asociados', function(err, associatesCollection){
        if(err){
          console.log('[/saveUserConfig]: ' + err);
          dbConnection.close(); console.log('[/saveUserConfig]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          associatesCollection.insertMany(req.body.associates, function(err, docs){
            if(err){
              console.log('[/saveUserConfig]: ' + err);
              dbConnection.close(); console.log('[/saveUserConfig]: Conexion cerrada con la BBDD');
              res.status(500).end();
            }
            else{
              console.log('[/saveUserConfig]: Asociados insertados en BBDD.');
              sendEmailsToAssociates(dbConnection, req.body);
              dbConnection.collection('particulares', function(err, particularsCollection){
                if(err){
                  console.log('[/saveUserConfig]: ' + err);
                  dbConnection.close(); console.log('[/saveUserConfig]: Conexion cerrada con la BBDD');
                  res.status(500).end();
                }
                else{
                  particularsCollection.update({firebaseID: req.body.clientUID}, {$set: { socialNetworks: req.body.socialNetworks, associates: docs.insertedIds, farewellLetter: req.body.farewellLetter }},
                    function(err, docs){
                      if(err){
                        console.log('[/saveUserConfig]: ' + err);
                        dbConnection.close(); console.log('[/saveUserConfig]: Conexion cerrada con la BBDD');
                        res.status(500).end();
                      }
                      else{
                        console.log('[/saveUserConfig]: Cliente actualizado con la configuración indicada');
                        dbConnection.close(); console.log('[/saveUserConfig]: Conexion cerrada con la BBDD');
                        res.status(200).end();
                      }
                      dbConnection.close();
                    }
                  );
                }
              });
            }
          })
        }
      });
    }
  });
});

function sendEmailsToAssociates(dbConnection, body){
  dbConnection.collection('particulares', function(err, particularsCollection){
    if(err){
      console.log('[/saveUserConfig]: ' + err);
      dbConnection.close(); console.log('[/saveUserConfig]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      particularsCollection.findOne({firebaseID: body.clientUID}, function(err, doc){
        if(err){
          console.log('[/saveUserConfig]: ' + err);
          dbConnection.close(); console.log('[/saveUserConfig]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          console.log(doc);
          for(var i = 0; i < body.associates.length; i++){
            var mailOptions = {
              to : body.associates[i].email,
              subject : "Mydite: Notificación a familiares y amigos",
              html : "¡Saludos de parte del equipo de Mydite!<br>" +
                     "Este correo tiene como objetivo informarle de que nuestro cliente " + doc.name + " " + doc.surname +
                     " nos ha indicado a través de nuestro sistema que quiere que usted sea una de las personas asociadas a su cuenta.<br>" +
                     "De este modo, usted será una de las personas encargadas tras el fallecimiento de nuestro cliente de cumplir con la voluntad de éste.<br>" +
                     "En caso de no estar conforme con lo mencionado, póngase en contacto con nuestro cliente para indicarle que no desea estar asociada a su cuenta," +
                     " de modo que éste pueda eliminarle del sistema.<br>" +
                     "El equipo Mydite le desea un buen día. No dude en contactar con nosotros ante cualquier duda que le surja."
            }
            smtpTransport.sendMail(mailOptions, function(error, emailResponse){
              if(error){
                console.log('[/saveUserConfig]: ' + error);
                res.status(500).end();
              }
              else console.log('[/saveUserConfig]: ' + 'Message sent: ' + emailResponse.message);
            });
          }
        }
      });
    }
  });
}

app.get('/userConfigDone', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/userConfigDone]: ' + err);
      dbConnection.close(); console.log('[/userConfigDone]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      console.log('[/userConfigDone]: Conexion establecida con la BBDD.');
      console.log(req.query);
      dbConnection.collection('particulares', function(err, collection){
        if(err){
          console.log('[/userConfigDone]: ' + err);
          dbConnection.close(); console.log('[/userConfigDone]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          collection.findOne({firebaseID: req.query.uid},
            function(err, doc){
              if(err){
                console.log('[/userConfigDone]: ' + err);
                dbConnection.close(); console.log('[/userConfigDone]: Conexion cerrada con la BBDD');
                res.status(500).end();
              }
              else{
                if(doc == null) res.send('Logout').end();
                else doc.socialNetworks ? res.send('Hecha').end() : res.send('No hecha').end();
                dbConnection.close(); console.log('[/userConfigDone]: Conexion cerrada con la BBDD');
              }
            }
          );
        }
      });
    }
  });
});

app.delete('/removeUser', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/removeUser]: ' + err);
      dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      console.log('[/removeUser]: Conexion establecida con la BBDD.');
      dbConnection.collection('particulares', function(err, collection){
        if(err){
          console.log('[/removeUser]: ' + err);
          dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          console.log('[/removeUser]: Conexion establecida con la colección particulares');
          collection.findOne({firebaseID: req.body.firebaseID, email: req.body.email, password: req.body.password},
            function(err, doc){
              if(err){
                console.log('[/removeUser]: ' + err);
                dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
                res.status(500).end();
              }
              else{
                if(doc == null){
                  console.log('[/removeUser]: El usuario no existe en la BBDD');
                  res.send('Los datos introducidos son erróneos').end();
                }
                else{
                  console.log('[/removeUser]: El usuario existe en la BBDD');
                  dbConnection.collection('asociados', function(err, collection){
                    if(err){
                      console.log('[/removeUser]: ' + err);
                      dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
                      res.status(500).end();
                    }
                    else{
                      console.log('[/removeUser]: Conexion establecida con la colección asociados');
                      for(var i = 0; i < doc.associates.length; i++){
                        collection.deleteOne({_id: doc.associates[i]}, function(err, doc){
                          if(err){
                            console.log('[/removeUser]: ' + err);
                            dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
                            res.status(500).end();
                          }
                          else{
                            console.log('[/removeUser]: Asociado eliminado');
                          }
                        });
                      }
                    }
                  });
                  collection.deleteOne(doc, function(err, doc){
                    if(err){
                      console.log('[/removeUser]: ' + err);
                      dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
                      res.status(500).end();
                    }
                    else{
                      console.log('[/removeUser]: Usuario eliminado de Mongo');
                      firebaseRef.removeUser({email: req.body.email, password: req.body.password}, function(error){
                        if(error){
                          console.log('[/removeUser]: ' + err);
                          dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
                          res.status(500).end();
                        }
                        else{
                          console.log('[/removeUser]: Usuario eliminado de Firebase');
                          res.send('Usuario eliminado').end();
                          dbConnection.close(); console.log('[/removeUser]: Conexion cerrada con la BBDD');
                        }
                      })
                    }
                  });
                }
              }
            }
          );
        }
      });
    }
  });
});

app.get('/getUserData/:firebaseID', function(req, res){
  var userData = {};
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/getUserData]: ' + err);
      dbConnection.close(); console.log('[/getUserData]: Conexion cerrada con la BBDD');
      res.status(500).end();
    }
    else{
      console.log('[/getUserData]: Conexion establecida con la BBDD.');
      dbConnection.collection('particulares', function(err, collection){
        if(err){
          console.log('[/getUserData]: ' + err);
          dbConnection.close(); console.log('[/getUserData]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          console.log('[/getUserData]: Conexion establecida con la colección particulares');
          collection.findOne({firebaseID: req.params.firebaseID}, function(err, doc){
            if(err){
              console.log('[/getUserData]: ' + err);
              dbConnection.close(); console.log('[/getUserData]: Conexion cerrada con la BBDD');
              res.status(500).end();
            }
            else{
              if(doc != null){
                console.log('[/getUserData]: El usuario existe en la BBDD');
                userData['associates'] = doc.associates;
                userData['socialNetworks'] = doc.socialNetworks;
                userData['farewellLetter'] = doc.farewellLetter;
                dbConnection.collection('asociados', function(err, collection){
                  if(err){
                    console.log('[/getUserData]: ' + err);
                    dbConnection.close(); console.log('[/getUserData]: Conexion cerrada con la BBDD');
                    res.status(500).end();
                  }
                  else{
                    console.log('[/getUserData]: Conexion establecida con la colección asociados');
                    collection.find({_id: { $in: userData.associates } }).toArray(function(err, docs){
                      if(err){
                        console.log('[/getUserData]: ' + err);
                        dbConnection.close(); console.log('[/getUserData]: Conexion cerrada con la BBDD');
                        res.status(500).end();
                      }
                      else{
                        for(var i = 0; i < docs.length; i++){
                          console.log(docs[i]);
                          console.log('[/getUserData]: Asociado agregado');
                          userData.associates[i] = docs[i];
                        }
                        res.json(userData).end();
                      }
                    });
                  }
                });
              }
              else{
                console.log('[/getUserData]: ' + err);
                dbConnection.close(); console.log('[/getUserData]: Conexion cerrada con la BBDD');
                res.status(500).end();
              }
            }
          });
        }
      });
    }
  });
});

app.put('/saveUserAssociates', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/saveUserAssociates]: ' + err);
      res.status(500).end();
    }
    else{
      console.log('[/saveUserAssociates]: Conexion establecida con la BBDD.');
      dbConnection.collection('particulares', function(err, particularsCollection){
        if(err){
          console.log('[/saveUserAssociates]: ' + err);
          dbConnection.close(); console.log('[/saveUserAssociates]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          particularsCollection.findOne({firebaseID: req.body.clientUID}, function(err, docs){
            if(err){
              console.log('[/saveUserAssociates]: ' + err);
              dbConnection.close(); console.log('[/saveUserAssociates]: Conexion cerrada con la BBDD');
              res.status(500).end();
            }
            else{
              var associatesIDs = docs.associates;
              dbConnection.collection('asociados', function(err, associatesCollection){
                if(err){
                  console.log('[/saveUserAssociates]: ' + err);
                  dbConnection.close(); console.log('[/saveUserAssociates]: Conexion cerrada con la BBDD');
                  res.status(500).end();
                }
                else{
                  associatesCollection.deleteMany({_id: {$in: associatesIDs}}, function(err, docs){
                    if(err){
                      console.log('[/saveUserAssociates]: ' + err);
                      dbConnection.close(); console.log('[/saveUserAssociates]: Conexion cerrada con la BBDD');
                      res.status(500).end();
                    }
                    else{
                      console.log('[/saveUserAssociates]: Asociados antiguos eliminados');
                      associatesCollection.insertMany(req.body.associates, function(err, docs){
                        if(err){
                          console.log('[/saveUserAssociates]: ' + err);
                          dbConnection.close(); console.log('[/saveUserAssociates]: Conexion cerrada con la BBDD');
                          res.status(500).end();
                        }
                        else{
                          console.log('[/saveUserAssociates]: Asociados nuevos insertados en BBDD.')
                          particularsCollection.update({firebaseID: req.body.clientUID}, {$set: { associates: docs.insertedIds}},
                            function(err, docs){
                              if(err){
                                console.log('[/saveUserAssociates]: ' + err);
                                dbConnection.close(); console.log('[/saveUserAssociates]: Conexion cerrada con la BBDD');
                                res.status(500).end();
                              }
                              else{
                                console.log('[/saveUserAssociates]: Cliente actualizado con la configuración indicada');
                                dbConnection.close(); console.log('[/saveUserAssociates]: Conexion cerrada con la BBDD');
                                res.status(200).end();
                              }
                              dbConnection.close();
                            }
                          );
                        }
                      })
                    }
                  });
                }
              });
            }
          })
        }
      });
    }
  });
});

app.put('/saveUserNetworks', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/saveUserNetworks]: ' + err);
      res.status(500).end();
    }
    else{
      console.log('[/saveUserNetworks]: Conexion establecida con la BBDD.');
      dbConnection.collection('particulares', function(err, particularsCollection){
        if(err){
          console.log('[/saveUserNetworks]: ' + err);
          dbConnection.close(); console.log('[/saveUserNetworks]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          particularsCollection.findOneAndUpdate({firebaseID: req.body.clientUID}, {$set: { socialNetworks: req.body.socialNetworks}}, function(err, docs){
            if(err){
              console.log('[/saveUserNetworks]: ' + err);
              dbConnection.close(); console.log('[/saveUserNetworks]: Conexion cerrada con la BBDD');
              res.status(500).end();
            }
            else{
              console.log('[/saveUserNetworks]: Cliente actualizado con la configuración indicada');
              dbConnection.close(); console.log('[/saveUserNetworks]: Conexion cerrada con la BBDD');
              res.status(200).end();
            }
            dbConnection.close();
          });
        }
      });
    }
  });
});

app.put('/saveUserLetter', function(req, res){
  var db = new mongodb.Db('Usuarios', server, {});
  db.open(function (err, dbConnection) {
    if(err){
      console.log('[/saveUserLetter]: ' + err);
      res.status(500).end();
    }
    else{
      console.log('[/saveUserLetter]: Conexion establecida con la BBDD.');
      dbConnection.collection('particulares', function(err, particularsCollection){
        if(err){
          console.log('[/saveUserLetter]: ' + err);
          dbConnection.close(); console.log('[/saveUserLetter]: Conexion cerrada con la BBDD');
          res.status(500).end();
        }
        else{
          particularsCollection.findOneAndUpdate({firebaseID: req.body.clientUID}, {$set: { farewellLetter: req.body.farewellLetter}}, function(err, docs){
            if(err){
              console.log('[/saveUserLetter]: ' + err);
              dbConnection.close(); console.log('[/saveUserLetter]: Conexion cerrada con la BBDD');
              res.status(500).end();
            }
            else{
              console.log('[/saveUserLetter]: Cliente actualizado con la configuración indicada');
              dbConnection.close(); console.log('[/saveUserLetter]: Conexion cerrada con la BBDD');
              res.status(200).end();
            }
            dbConnection.close();
          });
        }
      });
    }
  });
});

app.listen(3000, function(){
  console.log('Servidor iniciado con Express en puerto 3000')
});
