const express = require("express")
const colors = require("colors")
const process = require("process")
const fs = require("fs")
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const expressJWT = require("express-jwt")
const cors = require('cors')
const path = require('path')

//Create server, get port and load password for token signature
const server = express();
const port = process.argv[2];
const secrets = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.json')))
const cardsJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json')))
const usersJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json')))


//Middleware
server.use(bodyParser.json())
server.use(cors()); // le pasamos el cors, que gestionará las cabeceras de salida.

/* server.use(expressJWT({
    secret: secrets["jwt_clave"]
}).unless({
    path: ["/login", "/register"]
})) */

//Endpoints

server.get("/cards", (req, res) => {
    let cards = fs.readFile(cardsJSON, (err, data) => {
        if (err) console.log(err)
        cards = JSON.parse(data)
        res.send(cards)
    })
})

server.get("/card/:id", (req, res) => {
    let cards = fs.readFile(cardsJSON, (err, data) => {
        if (err) console.log(err)
        cards = JSON.parse(data)
        let singleCard;
        console.log("params id:", req.params.id)
        for (let i = 0; i < cards.length; i++) {
            if (req.params.id == cards[i]["id"]) {
                singleCard = {...cards[i]}
                console.log(singleCard)
            }            
        }
        if (singleCard != undefined) {
            res.send({"status":"OK", "cards": singleCard})
        } else {
            res.send({
                "status": "Error",
                "message": "No card with that ID in the database"
            })
        }
    })
})

function checkCardData(cardData, cardList) {
    //check body integrity

    if (cardData["id"] == undefined || cardData["name"] == undefined || cardData["id"] == "" || cardData["name"] == "") {
        return "Card data incomplete. Must have an ID and a Name"
    }
    //check if card already exists

    for (let i = 0; i < cardList.length; i++) {
        if (cardData["id"] == cardList[i]["id"]) {
            return "This card is already in the database. Must have a different ID"
        }
    }
    return "OK"
}

server.post("/cards", (req, res) => {
    let cardData = req.body;
    fs.readFile(cardsJSON, (err, data) => {
        if (err) {
            console.log(err);
        }

        let cardList = JSON.parse(data)
        let check = checkCardData(cardData, cardList)
        if (check != "OK") {
            console.log(check.red)
            res.send({
                "status": "Error",
                "message": check
            })
        } else {
            cardList.push(cardData);
            fs.writeFile(cardsJSON, JSON.stringify(cardList), (err, data) => {
                console.log("Card added correctly.")
                res.send({
                    "status": "OK",
                    "message": "Card added correctly",
                    "cards": cardList
                })
            })
        }
    })
})


server.put("/card", (req, res) => {
    let cardData = req.body;
    fs.readFile(cardsJSON, (err, data) => {
        if (err) {
            console.log(err);
        }

        //check body integrity

        if (cardData["id"] == undefined || cardData["name"] == undefined || cardData["id"] == "" || cardData["name"] == "") {
            console.log("Card data incomplete. Must have an ID and a Name".red)
            res.send({
                "status": "Error",
                "message": "Card data incomplete. Must have an ID and a Name"
            })
        } else {

            let cardList = JSON.parse(data)
            let cardToEditPosition = -1;
            for (let i = 0; i < cardList.length; i++) {
                if (cardData["id"] == cardList[i]["id"]) {
                    cardToEditPosition = i;
                }
            }
            if (cardToEditPosition < 0) {
                console.log("No card with that ID in the database".red)
                res.send({
                    "status": "Error",
                    "message": "No card with that ID in the database"
                })
            } else {
                //Edit card
                let keys = Object.keys(cardData);
                for (let i = 0; i < keys.length; i++) {
                    cardList[cardToEditPosition][keys[i]] = cardData[keys[i]];
                }
                fs.writeFile(cardsJSON, JSON.stringify(cardList), (err, data) => {
                    console.log("Card modified correctly.".yellow)
                    res.send({
                        "status": "OK",
                        "message": "Card modified correctly",
                        "card": cardList[cardToEditPosition]
                    })
                })
            }
        }

    })
})


//Configuramos los endpoints

//register

server.post("/register", (req, res) => {
    //check body is correct
    if (req.body["username"] != undefined && req.body["username"] != "" && req.body["password"] != undefined && req.body["password"] != "") {
        //check if user is already registered
        fs.readFile(usersJSON, (err, data) => {
            if (err) {
                console.log(err)
            }
            let usersData = JSON.parse(data);
            let userFound = false;
            for (let i = 0; i < usersData.length; i++) {
                if (usersData[i]["username"] == req.body["username"]) {
                    userFound = true;
                    console.log("User already exists".red)
                    res.send({
                        "status": "Error",
                        "message": "There already exists a user with the same username. Please choose a different one"
                    })
                }
            }
            if (!userFound) {
                //Hash of the password
                bcrypt.hash(req.body["password"], 13, (err, hash) => {
                    usersData.push({
                        "username": req.body["username"],
                        "password": hash
                    })
                    fs.writeFile(usersJSON, JSON.stringify(usersData), (err, data) => {
                        console.log("User registered".green)
                        res.send({
                            "status": "OK",
                            "message": "User registered correctly. You can log in now :)"
                        })
                    })
                })
            }
        })
    }
})

//login

server.post("/login", (req, res) => {
    //check if body is correct

    if (req.body["username"] != undefined && req.body["username"] != "") {
        //check if username exists
        fs.readFile(usersJSON, (err, data) => {
            if (err) {
                console.log(err)
            }

            let usersData = JSON.parse(data);
            let userFound;

            for (let i = 0; i < usersData.length; i++) {
                if (usersData[i]["username"] == req.body["username"]) {
                    userFound = usersData[i];
                }
            }
            if (userFound != undefined) {
                //check if password is correct. compare hash with the one in the users.json file
                bcrypt.compare(req.body["password"], userFound["password"], (err, result) => {

                    if (!result) {
                        console.log("Password incorrect".red);
                        res.send({
                            "status": "Error",
                            "message": "Login incorrect"
                        })
                    } else {
                        //create token
                        jwt.sign({
                            "username": userFound["username"]
                        }, secrets["jwt_clave"], (err, token) => {
                            console.log("Login correct".green)
                            res.send({
                                "status": "OK",
                                "message": "Login correct",
                                "token": token
                            })
                        })
                    }

                })
            } else {
                console.log("Login incorrect".red)
                res.send({
                    "status": "Error",
                    "message": "Login incorrect"
                })
            }
        })
    } else {
        console.log("Login incorrect".red)
        res.send({
            "status": "Error",
            "message": "Login incorrect"
        })
    }
})




if (!fs.existsSync(usersJSON)) {
    fs.writeFileSync(usersJSON, "[]");
}


server.listen(port, () => {
    console.log("Escuchando en puerto " + port)
});