const log = require("./log");
// modules
log("info", "Loading modules...");
const express = require('express');
const morgan = require("morgan");
const path = require("path");
const app = express();
const hbs = require("express-handlebars");
const session = require("express-session");
const MySqlStore = require("express-mysql-session");
const passport = require("passport");
const flash = require("connect-flash");
const SocketIO = require('socket.io');
const db = require("./connection");
const wait = require("util").promisify(setTimeout);
require("./passport");
log("success", "Modules Successfully loaded.");
process.on("unhandledRejection", err => {
	log("error", err.stack);
});
// settings
log("info", "Loading settings...");
app.set('port', 3000);
log("success", "Settings successfully loaded.");
// Definiendo motor de vista
log("info", "Loading views engine...");
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', ".html"); // acá indico que el motor manejará archivos de extension .html
app.engine(".html", hbs.engine({
	extname: ".html",
	layout: "main"
}));
log("success", "Views engine successfully loaded.");
// middlewares
log("info", "Loading middlewares...");
app.use(session({
	secret: "sUpErsEcrEt",
	resave: false,
	saveUninitialized: false,
	store: new MySqlStore({
		host: "localhost",
		user: "root",
		database: "data"
	})
})); // middleware para el manejo de sesiones
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));
// inicializo passport
app.use(passport.initialize());
app.use(passport.session());
// inicializo flash
app.use(flash());
log("success", "Middlewares successfully loaded.");
// global variables
app.use(async function (req, res, next) {
	app.locals.success = req.flash("success"); // variable global para alertas de tipo success con flash
	app.locals.error = req.flash("error"); // variable global para alertas de tipo error con flash
	app.locals.user = req.user; // variable global para el usuario actual
	if (!req.user) {
		// si no hay usuario, se crea la variable global para indicar que no hay usuario
		app.locals.nouser = true;
	}
	// de haber usuario, se elimina la anterior mencionada variable global
	if (req.user) app.locals.nouser = undefined;
	if (req.user) {
		// si hay usuario y es admin, la variable local isAdmin se crea, de lo contrario, se crea la variable global 'noAdmin'
		if (req.user.isAdmin === "yes") app.locals.isAdmin = true;
		else app.locals.noAdmin = true;
	}
	else if (!req.user) {
		// si no hay usuario ambas variables se eliminan
		app.locals.isAdmin = undefined;
		app.locals.noAdmin = undefined;
	}
	next();
});
// routes
log("info", "Loading routes...");
app.use("/js", express.static(path.join(__dirname, "js"))); // establecer como archivos estáticos todos los de la carpeta js en la ruta /js
app.use("/css", express.static(path.join(__dirname, "css"))); // establecer como archivos estáticos todos los de la carpeta css en la ruta /css
app.use("/img", express.static(path.join(__dirname, "img"))); // establecer como archivos estáticos todos los de la carpeta img en la ruta /img
app.use('/', require('./routes/router')); // cargando el router en la ruta principal
log("success", "Routes successfully loaded.");
// starting the server
log("info", "Starting web server...");
// Almaceno el servidor en una constante
const server = app.listen(app.get('port'), () => {
	log(`success`, `Successfully started Web Server on port ${app.get("port")}`);
});
// WebSockets
const io = SocketIO(server);
io.on("connection", async socket => {
	log("info", `Received new WebSocket connection (${socket.id})`);
	// evento para revisar si el producto existe
	socket.on("check-product", async data => {
		log("info", `Received check-product event from socket ${socket.id}, looking for a product with id ${data.productId}...`);
		// reviso si el producto existe en la base de datos
		const found = await db.query(`SELECT * FROM products WHERE products.id = ?`, [data.productId]);
		if (found.length > 0) {
			// si el length del array devuelto por el query es mayor a 0, el producto existe y se le envia los datos al socket
			log("info", "Product exists, sending response to the socket...");
			socket.emit("check-product-response", {
				exists: true,
				data: found[0],
				uniqueToken: data.uniqueToken
			});
			log("success", "Response successfully sent to the socket");
		}
		else {
			// de lo contrario, se le responde al socket diciendo que el producto no existe
			log("info", "Product does not exists, sending response to socket...");
			socket.emit("check-product-response", {
				exists: false,
				data: {},
				uniqueToken: data.uniqueToken
			});
			log("success", "Product successfully sent to the socket");
		}
	});
	// evento para guardar los datos del carrito en la base de datos
	socket.on("store-cart", async data => {
		log("info", `Received store-cart event from socket (${socket.id})`);
		// compruebo si existe el carrito en la base de datos
		const filteredCarts = await db.query(`SELECT * FROM carts WHERE carts.userid = ?`, [data.userid]);
		if (filteredCarts.length > 0) {
			// si existe, se actualiza
			await db.query(`UPDATE carts SET carts.data = '${data.cartData}'`);
			socket.emit("store-cart-response", true);
		}
		else {
			// si no existe, se crea en la base de datos
			const cartObject = {
				userid: data.userid,
				data: data.cartData
			};
			await db.query(`INSERT INTO carts SET ?`, [cartObject]);
			socket.emit("store-cart-response", true);
		}
	});
	// evento para obtener los datos del carrito
	socket.on("get-cart", async data => {
		// compruebo si el carrito existe
		const fCarts = await db.query(`SELECT * FROM carts WHERE carts.userid = ?`, [data.userid]);
		if (fCarts.length < 1) {
			// si no existe, se le responde al socket con que el carrito no existe
			socket.emit("get-cart-response", {
				cartExists: false,
				uniqueToken: data.uniqueToken
			});
		}
		else {
			// de lo cotnrario, se le envian los datos del carrito
			socket.emit("get-cart-response", {
				cartExists: true,
				cartData: fCarts[0].data,
				uniqueToken: data.uniqueToken
			});
		}
	});
	// evento que recibe un array de productos y devuelve uno nuevo con items inválidos removidos
	socket.on("check-products", async data => {
		const items = data.items;
		let invalidItems = [];
		let removedLength = 0;
		// empiezo a recorrer el array
		items.forEach(async (item, index) => {
			// compruebo si existe
			const foundI = await db.query(`SELECT * FROM products WHERE products.id = '${item.id}'`);
			if (foundI.length < 1 || foundI[0].stock < 1) {
				// si no existe o su stock es menor a 1, le paso el index del item al array invalidItems
				invalidItems.push(index);
			}
		});
		// espero 2 segundos para que el bucle tenga tiempo suficiente de recorrer el array en caso de ser más grande
		await wait(2000);
		// recorro el array invalidItems
		for (const i of invalidItems) {
			items.splice(i, 1);
			removedLength += 1;
			// remuevo el item del array items y sumo 1 al contador de items removidos
		}
		// le envio al socket el array con los items inválidos removidos
		socket.emit("check-products-response", {
			items: items,
			uniqueToken: data.uniqueToken,
			removedLength
		});
	});
});