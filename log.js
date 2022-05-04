const colors = require("colors");
// función para logs
function log(type, message) {
	const date = new Date();
	const hours = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
	if (type.toLowerCase() === "info") {
		console.log(`[${hours}][INFO]: ${message}`.grey);
	}
	else if(type.toLowerCase() === "warn" || type.toLowerCase() === "warning") {
		console.log(`[${hours}][WARNING]: ${message}`.yellow);
	}
	else if (type.toLowerCase() === "error") {
		console.log(`[${hours}][ERROR]: ${message}`.brightRed);
	}
	else if (type.toLowerCase() === "success") {
		console.log(`[${hours}][SUCCESS]: ${message}`.green);
	}
}
module.exports = log;