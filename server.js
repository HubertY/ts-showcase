let express = require("express");
let path = require("path");
let app = express();
let http = require("http");

let server = new http.Server(app);


app.use(express.static(path.join(__dirname, "build")));

app.get("/", function (req, res) {
	res.sendFile(__dirname + "/build/index.html");
});


server.listen(1337, function () {
	console.log("listening on *:1337");
});
