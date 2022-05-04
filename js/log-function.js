// función para logs
function log(type, message) {
	const date = new Date();
	const hours = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
	if (type.toLowerCase() === "info") {
		console.log(`%c[${hours}][INFO]: ${message}`, "color: grey;");
	}
	else if (type.toLowerCase() === "warn" || type.toLowerCase() === "warning") {
		console.log(`%c[${hours}][WARNING]: ${message}`, "color: yellow;");
	}
	else if (type.toLowerCase() === "error") {
		console.log(`%c[${hours}][ERROR]: ${message}`, "color: red;");
	}
	else if (type.toLowerCase() === "success") {
		console.log(`%c[${hours}][SUCCESS]: ${message}`, "color: green;");
	}
}