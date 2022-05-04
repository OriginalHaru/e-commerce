const router = require('express').Router();
const db = require("../connection");
const log = require("../log");
const passport = require("../passport");
// función que genera un ID único con el length que se le proporcione
function genId(length) {
	const chars = "aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ";
	let char = "";
	for (let i = 0; i < length; i++) {
		char += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return char;
}
// función que envía un 401 si el usuario no está logueado
function notLogged(req, res, next) {
	if (!req.isAuthenticated()) {
		return res.status(401).render("401", {
			title: "401 - Not authorized"
		});
	}
	next();
}
// función que redirecciona a la ruta /profile si el usuario ya está logueado
function alreadyLogged(req, res, next) {
	if (req.isAuthenticated()) {
		return res.redirect("/profile");
	}
	next();
}
// función que envía un 401 si el usuario no es administrador
function onlyAdmin(req, res, next) {
	if (req.user.isAdmin === "yes") {
		return next();
	}
	return res.status(401).render("401", {
		title: "401 - Not authorized"
	});
}
// handler para la ruta /
router.get("/", (req, res) => {
	// agarro todos los productos de la base de datos
	db.query(`SELECT * FROM products`, async (err, results, fields) => {
		if (err) {
			// si hay un error lo registro en consola y le muestro al usuario un mensaje de error
			log("error", `An unexpected error ocurred while trying to fetch data from the database\n${err}`);
			return res.status(500).render("500", {
				title: "500 - Internal Server Error",
				message: "Couldn't fetch data from the database"
			});
		}
		// de no haber error, renderizo el archivo index pasándole el array de los productos
		res.render("index", {
			title: "Home",
			products: results.filter(r => r.deleted !== "yes")
		});
	});
});
// handler para la ruta /logout
router.get("/logout", notLogged, (req, res) => {
	// cierro la sesión del usuario y lo redirijo a la ruta /
	req.logout();
	res.redirect("/");
});
// handler para la ruta /login
//                   ............. <--- al estar la función alreadyLogged significa que de estar el usuario logueado, será redirigido a la ruta /profile 
router.get("/login", alreadyLogged, (req, res) => {
	// renderizo el archivo login.html
	res.render("login", {
		title: "Login"
	});
});
// handler para la ruta /login método POST
router.post("/login", passport.authenticate("local.signin", {
	successRedirect: "/profile",
	failureRedirect: "/login?failed=true"
}));
//                      ............. <--- al estar la función alreadyLogged significa que de estar el usuario logueado, será redirigido a la ruta /profile
router.get("/register", alreadyLogged, (req, res) => {
	res.render("register", {
		title: "Register"
	});
});
// handler para la ruta /register método POST
router.post("/register", passport.authenticate("local.signup", {
	successRedirect: "/profile",
	failureRedirect: "/register?failed=true"
}));
// handler para la ruta /profile
//                     ......... <--- al estar la función notLogged significa que de no estar logueado el usuario, se le retornará un 401
router.get("/profile", notLogged, (req, res) => {
	res.render("profile", {
		title: `${req.user.username}'s profile'`
	});
});
// handler para la ruta /add
//                            ......... <--- al estar la función onlyAdmin significa que de no estar logueado el usuario o no ser administrador, se le retornará un 401
router.get("/add", notLogged, onlyAdmin, (req, res) => {
	res.render("add", {
		title: "Add product"
	});
});
// handler para la ruta /add método POST
router.post("/add", notLogged, onlyAdmin, async (req, res) => {
	// genero una id única para el producto
	const gentID = genId(10);
	// inserto los datos en la base de datos
	await db.query(`INSERT INTO products (id, stock, price, imageURL, summary, name, deleted, ownerId) VALUES ('${gentID}', '${Number(req.body.stock)}', '${Number(req.body.price)}', '${req.body.imageURL}', '${req.body.sumary}', '${req.body.name}', 'no', '${req.user.id}')`);
	// creo un mensaje de que el producto se añadió con éxito
	req.flash("success", "Producto añadido con éxito");
	// lo redirigo nuevamente a a ruta /add
	res.redirect("/add");
});
router.get("/product/:id", async (req, res) => {
	// verifico si el porducto existe
	db.query(`SELECT * FROM products WHERE products.id = '${req.params.id}'`, async (err, result, fields) => {
		if (err) {
			// si hay un error lo registro en consola y se lo notifico al usuario
			log("error", `An unexpected error ocurred while trying to fetch data from the database\n${err}`);
			return res.status(500).render("500", {
				title: "500 - Internal Server Error",
				message: "Couldn't fetch data from the database"
			});
		}
		// si el producto no está en la base de datos o sale como eliminado, devuelve un 404
		if (result.length < 1 || result[0].deleted === "yes") return res.status(404).render("404", {
			title: "404 - Not found",
			message: "El producto solicitado no fue encontrado"
		});
		// si no, renderizo el archivo product.html pasándole los datos del producto
		res.render("product", {
			title: "View product",
			data: result[0]
		});
	});
});
// handler para la ruta /delete
router.get("/delete", notLogged, onlyAdmin, async (req, res) => {
	if (req.query.invalid) return res.render("delete", {
		title: "Delete a product",
		invalid: true,
		id: req.query.id
	});
	if (req.query.success) return res.render("delete", {
		title: "Delete a product",
		name: req.query.productName
	});
	res.render("delete", {
		title: "Delete a product"
	});
});
// handler para la ruta /products/delete
router.get("/products/delete", notLogged, onlyAdmin, async (req, res) => {
	const id = req.query.id;
	// si no está el query id, redirige a la ruta /
	if (!id) return res.redirect("/");
	// busco el producto en la base de datos
	await db.query(`SELECT * FROM products WHERE products.id = '${id}'`, async (err, result, fields) => {
		if (err) {
			// si hay un error, lo registro y le notifico al usuario
			log("error", `An unexpected error ocurred while trying to fetch data from the database\n${err}`);
			return res.status(500).render("500", {
				title: "500 - Internal Server Error",
				message: "Couldn't fetch data from the database"
			});
		}
		// si no existe el producto o sale como eliminado, se le dice al usuario que la id no es válida
		if (result.length < 1 || result[0].deleted === "yes") {
			req.flash("error", `La ID '${id}' es inválida`);
			res.redirect("/delete?invalid=true&id=" + id);
		}
		else {
			// sino, elimino el producto de la base de datos y le digo al usuario que la operación fue correcta
			await db.query(`DELETE FROM products WHERE products.id = '${id}'`);
			req.flash("success", "Producto eliminado con éxito");
			res.redirect("/delete?success=true&productName=" + result[0].name);
		}
	});
});
// handler para la ruta /results
router.get("/results", async (req, res) => {
	if (!req.query.search_query) return res.redirect("/"); // si no hay parámetro search_query redirige a la ruta /
	const query = req.query.search_query;
	// agarro todos los productos de la base de datos
	let products = await db.query("SELECT * FROM products");
	// filtro los datos
	products = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.summary.toLowerCase().includes(query.toLowerCase()));
	// renderizo el archivo results.html
	res.render("results", {
		title: `Results`,
		products: products
	});
});
// handler para la ruta /edit
router.get("/edit", async (req, res) => {
	if (!req.query.productId) return res.redirect("/"); // si no hay parámetro productId redirige a la ruta /
	const { productId } = req.query;
	const productsQuery = await db.query(`SELECT * FROM products WHERE products.id = ?`, [productId]);
	// busco el producto en la base de datos
	if (productsQuery.length < 1) return res.status(404).render("404", {
		title: "404 - Not found",
		message: "El producto solicitado no fue encontrado"
	}); // si no existe el producto renderizo un 404, sino, renderizo el archivo edit.html pasándole los datos del producto
	res.render("edit", {
		product: {
			data: productsQuery[0]
		}
	});
});
router.post("/edit", notLogged, onlyAdmin, async (req, res) => {
	const { name, imageURL, stock, price, summary } = req.body;
	// creo el objeto de l producto
	const object = {
		name,
		imageURL,
		stock,
		price,
		summary,
		ownerId: req.user.id,
		deleted: "no"
	};
	// actualizo el producto y le digo al usuario que la operación fue éxitosa
	await db.query("UPDATE products SET ? WHERE products.id = ?", [object, req.body.id]);
	req.flash("success", "Producto editado con éxito");
	res.redirect(`/edit?productId=${req.body.id}&success=true`);
});
// handler para la ruta /cart la cual se carga enteramente por el CartManager
router.get("/cart", notLogged, async (req, res) => {
	res.render("cart", {
		title: "Loading..."
	});
});
// handler para la ruta /pay método POST
router.post("/pay", notLogged, async (req, res) => {
	const { total, userid, itemsLength } = req.body;
	// compruebo si el carrito existe
	const foundCarts = await db.query(`SELECT * FROM carts WHERE carts.userid = ?`, [userid]);
	if (foundCarts.length < 1) {
		// si no existe se lo notifico al usuario
		req.flash("error", `Ha ocurrido un error extraño... tu carrito no está en la base de datos!`);
		return res.redirect("/");
	}
	// lo redirijo a la ruta /ticke pasándole los datos correspondientes
	const cart = JSON.parse(foundCarts[0].data)
	res.redirect(`/ticket?total=${total}&userid=${userid}&length=${itemsLength}&products=${cart.items.map(i => i.id).join("%20")}`);
	// le resto 1 al stock de todos los productos en el carrito del usuario
	for (const item of cart.items) {
		const it = await db.query("SELECT * FROM products WHERE products.id = ?", [item.id]);
		await db.query(`UPDATE products SET products.stock = ${it[0].stock - 1}`);
	}
});
router.get("/ticket", notLogged, async (req, res) => {
	const { total, userid, length, products } = req.query;
	const items = [];
	// recorro todos los productos del query
	for (const product of products.trim().split(/ +/g)) {
		// compruebo si existe
		const item = await db.query(`SELECT * FROM products WHERE products.id = ?`, [product]);
		// si no existe o tiene un stock menor a 1 redirige al usuario a la ruta /cart
		if (item.length < 1 || item[0] && item[0].stock < 1) return res.redirect("/cart");
		items.push(item[0]);
	}
	// renderizo el archivo ticket pasándole los datos
	res.render("ticket", {
		data: {
			total,
			itemsLength: length,
			products: items
		},
		title: `Ticket`
	});
	// vacío el carrito del usuario
	await db.query(`UPDATE carts SET carts.data = ? WHERE carts.userid = ?`, [JSON.stringify({ userid, items: [] }), userid]);
});
// handler para la ruta /panel
router.get("/panel", notLogged, onlyAdmin, async (req, res) => {
	res.render("panel", {
		title: "Admin panel"
	});
});
// handler para la ruta /users/delete método POST
router.post("/users/delete", async (req, res) => {
	// compruebo que el usuario existe
	const foundUs = await db.query(`SELECT * FROM users WHERE users.id = ?`, [req.body.id]);
	if (foundUs.length < 1) {
		// si no existe le digo al administrador que la ID no existe
		req.flash("error", `La ID '${req.body.id}' no pertenece a ningún usuario!`);
		return res.redirect(`/panel/deleteusers?success=false&id=${req.body.id}`);
	}
	// elimino al usuario y le digo que la operación fue éxitosa
	await db.query(`DELETE FROM users WHERE users.id = ?`, [req.body.id]);
	req.flash("success", `El usuario '${foundUs[0].username}' ha sido eliminado con éxito`);
	res.redirect(`/panel/deleteusers?success=true&username=${foundUs[0].username}`);
});
// handler para la ruta /panel/deleteusers
router.get("/panel/deleteusers", notLogged, onlyAdmin, async (req, res) => {
	req.query.id ? res.render("deleteUser", { title: "Delete user", id: req.query.id }) : res.render("deleteUser", { title: "Delete user", noid: true });
});
// handler para la ruta /panel/searchusers
router.get("/panel/searchusers", notLogged, onlyAdmin, async (req, res) => {
	res.render("searchUsers", {
		title: "Search users"
	});
});
// handler para la ruta /panel/results
router.get("/panel/results", notLogged, onlyAdmin, async (req, res) => {
	const query = req.query.search_query;
	if (!query) return res.redirect("/panel/searchusers"); // si no está el parámetro search_query redirige a la ruta /panel/searchusers
	const allUsers = await db.query(`SELECT * FROM users`); // obtengo todos los usuarios
	const filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(query.toLowerCase()) || u.fullName.toLowerCase().includes(query.toLowerCase())); // filtro los usuarios por nombre y nombre de usuario
	// renderizo el archiv resultUsers.html pasándole los datos de los usuarios que pasaron el filtro
	res.render("resultUsers", {
		title: "Results",
		users: filteredUsers
	});
});
// handler para la ruta /panel/updateusers
router.get("/panel/updateusers", notLogged, onlyAdmin, async (req, res) => {
	if (!req.query.id) res.redirect("/panel"); // si no está el parámetro id redirige a la ruta /panel
	const { id } = req.query;
	const foundUs = await db.query(`SELECT * FROM users WHERE users.id = ?`, [id]); // verifico si el usuario existe
	if (foundUs.length < 1) {
		// si no existe tira 404
		return res.status(404).render("404", {
			title: "404 - Not found",
			message: "La ID especificada no pertenece a ningún usuario"
		});
	}
	// renderizo el archivo updateUser.html pasándole los datos
	const user = foundUs[0];
	res.render("updateUser", {
		title: `Update ${user.username}`,
		data: user
	});
});
// handler para la ruta /users/update método POST
router.post("/users/update", notLogged, onlyAdmin, async (req, res) => {
	const foundU = await db.query('SELECT * FROM users WHERE users.id = ?', [req.body.id]); // verifico si el usuario existe
	if (foundU.length < 1) return res.redirect(`/panel/updateusers?id=${req.body.id}`); // si no existe redirige a /panel/updateusers
	if (req.body.isAdmin.toLowerCase() !== "no" && req.body.isAdmin.toLowerCase() !== "yes") {
		// la propiedad isAdmin debe ser "yes" o "no", si no es ninguna tira error
		req.flash("error", "El valor de 'es admin' debe ser 'yes' o 'no'");
		return res.redirect(`/panel/updateusers?id=${req.body.id}`);
	}
	// creo el objeto del usuario
	const userObject = {
		username: req.body.username,
		fullName: req.body.fullName,
		isAdmin: req.body.isAdmin
	}
	// lo actualizo en la base de datos y le digo al admin que la operación fue éxitosa
	await db.query(`UPDATE users SET ? WHERE users.id = ?`, [userObject, req.body.id]);
	req.flash("success", `Usuario '${req.body.username}' actualizado con éxito`);
	res.redirect("/panel");
});
module.exports = router;