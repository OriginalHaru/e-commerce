const mysql = require("mysql");
const { promisify } = require("util");
// creo la conexión con la base de datos
const connection = mysql.createConnection({
	host: "localhost",
	user: "root",
	database: "data"
});
// conecto a la base de datos
connection.connect();
// hago el método query asíncrono con promisify y exporto la conexión
connection.query = promisify(connection.query);
module.exports = connection;