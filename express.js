const express = require('express')
const session = require('express-session')

const model = require('./goals');
const cors = require('cors');
const app = express();

app.use(cors());

const request = require('request');
app.use(express.static("public")); //folder name where are my client files will be next to express.js
app.use(express.urlencoded({ extended: false}));
app.use(session({
    secret: "a;lskdjfowiewej943ojifaklsfdj9oiwjfasldkfj",
    resave: false,
    saveUninitialized: true,
    cookie: {secure: false}
}));

// my middleware

function authorizeRequest(owner) {
    return function (request, response, next) {
        if (request.session && request.session.userId) {
            model.User.findOne({ _id: request.session.userId }).then(function (user) {
                if (user){ // && (!adminOnly || user.admin)) {
                    request.user = user;
                    next(); // Proceed to next middleware/endpoint
                } else {
                    response.status(401).send("Not authenticated");
                    console.log("authorizeRequest(adminOnly")
                }
            }).catch(error => {
                console.error("Error finding user:", error);
                response.status(500).send("Internal Server Error");
            });
        } else {
            response.status(401).send("Not authenticated");
            console.log("authorizeRequest(adminOnly last one")
        }
    };
}
    
app.get("/goals", authorizeRequest(true), function (request, response) {
    model.goal.find().populate('user').then((goals) => {
        console.log("goals from db", goals);
        response.json(goals);
    })
})

app.get("/goals", authorizeRequest(true), function (request, response) {
    console.log("session", request.session)
    model.goal.find().then((goals) => {
        console.log("goals from db", goals);
        response.json(goals);
    })
})

app.get("/goals/:goalId", authorizeRequest(true), function (request, response) {
    console.log("retrieve goal with id: ", request.params.goalId)
    model.goal.findOne({_id: request.params.goalId}).then((goal) => {
        if (goal) {
            console.log("goals from db ", goal);
            response.json(goal);
        } else {
            response.sendStatus(404);
        }
    }).catch((error) => {
        console.error("Faild to query goal with ID: ", request.params.goalId);
        response.sendStatus(404);
    })
})

app.delete("/goals/:goalId", authorizeRequest(true), function (request, response) {
    console.log("delete goal with Id: ", request.params.goalId)
    console.log(request.user._id);
    //if (request.user._id == request.params.goalId) {} could use this instead of just searching for goals with userId
    model.goal.deleteOne({_id: request.params.goalId, user: request.user._id }).then((goal) => {
        if(goal) {
            console.log("goals from db", goal);
            response.json(goal);
        } else {
            response.sendStatus(404);
        }
    }).catch((error) => {
        console.error("Failed to delete goal with ID: ", request.params.goalId);
        response.sendStatus(404);
    })
})

app.put("/goals/:goalId", authorizeRequest(true), function (request, response) {
    console.log("edit goal by Id ", request.params.goalId)
    const goalId = request.params.goalId
    const updatedGoalData = request.body;

    model.goal.findOneAndUpdate({_id: goalId, user: request.user._id }, updatedGoalData, {new:true}).then((updatedGoal) => {
        if(updatedGoal) {
            console.log("goals from db", updatedGoal);
            response.status(204).json(updatedGoal);
        } else {
            response.sendStatus(404);
        }
    }).catch((error)=> {
        if (error.errors) {
            var errorMessages = {};
            for (var fieldName in error.errors){
                errorMessages[fieldName] = error.errors[fieldName].message
            }
            response.status(422).json(errorMessages);
            console.error("Failed to edit goal by Id: ", request.params.goalId);
        } else {
            response.status(500).send("Unknown error creating goal.")
        }
    })
})

app.post("/goals", authorizeRequest(true), function (request, response) {
	console.log("request body:", request.body)

    const newGoals = new model.goal({
        name: request.body.name,
        myGoal: request.body.myGoal,
        frequency: request.body.frequency,
        duration: request.body.duration,
        why: request.body.why,
        when: request.body.when,
        user: request.session.userId
    })
	newGoals.save().then(() => {
        response.status(201).json("new goals added")
    }).catch((error) => {
        if (error.errors){ //mongoose validation failed
            var errorMessages = {};
            for (var fieldName in error.errors){
                errorMessages[fieldName] = error.errors[fieldName].message
            }
            response.status(422).json(errorMessages); 
        } else {
            response.status(500).send("Unknown error creating goal.")
        }
    });  
})

// register new user
app.post("/users", function (request, response) {
	console.log("request body:", request.body)

    const newUser = new model.User({
        firstName: request.body.firstName,
        lastName: request.body.lastName,
        email: request.body.email
    })

    newUser.setEncryptedPassword(request.body.plainPassword).then(function () {
        //at this time the password has been encrypted and stored.
        newUser.save().then(() => {
            response.status(201).json("new user added")
        }).catch((error) => {
            if (error.errors){ //mongoose validation failed
                var errorMessages = {};
                for (var fieldName in error.errors){
                    errorMessages[fieldName] = error.errors[fieldName].message
                }
                response.status(422).json(errorMessages); 
            } else if (error.code == 11000){
                console.log(error)
                response.status(422).json({email: "User with email already exists" })
            } else {
                console.error("Unknown error creating user:", error)
                response.status(500).send("Unknown error creating user.") //need to figure out how to handle this error
            }
        });  
    })
})

//retrieve session
app.get("/session", function (request, response) {
    // response.json(request.user)

    console.log("session", request.session)
    if(request.session && request.session.userId) {
        console.log("logged in")
        response.status(200).send("Authenticated")
    } else {
        response.status(401).send("Not Authenticated")
    }
})
//logout

app.delete("/session", authorizeRequest(true), function (request, response){
    request.session.userId = null;
    response.status(200).send("Successfully logged out.")
});
// delete user
app.delete("/user", authorizeRequest(true), function (request, response) {
    model.User.deleteOne({email: request.body.email }).then(function (user) {
        if (user) {
            user.verifyEncryptedPassword(request.body.plainPassword).then(function (match) {
                if (match) {
                    request.session.userId = user._id
                    response.status(201).send("Authenticated")
                } else {
                    response.status(401).send("Not Authenticated")
                }
            })
        } else {
            response.status(401).send("Not Authenticated")
        }
    })
})

//create session (login)
app.post("/session", function (request, response) {
    // get user credentials request.body.email & request.body.plainPassword
    // verify their email first from DB using given email
    // if email is found then verify given password against encrypted password from DB
    //      if password is verified, then respond with 201
    //      else respond with 401
    // else respond with 401

    model.User.findOne({email: request.body.email }).then(function (user) {
        if (user) {
            user.verifyEncryptedPassword(request.body.plainPassword).then(function (match) {
                if (match) {
                    // save user's id into session data
                    // request.session.whateverYouWant = somethingUseful
                    request.session.userId = user._id;
                    response.status(201).send("Authenticated, Login Successful")
                } else {
                    response.status(401).send("Not Authenticated, Login Failed")
                }
            })
        } else {
            response.status(401).send("Not Authenticated, Login Failed")
        }
    })
})

app.listen(8080, function () {
    console.log("Server is running...")
})