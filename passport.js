const passport = require("passport");
const bcrypt = require("bcryptjs");
const connection = require('./connection');
const LocalStrategy = require("passport-local").Strategy;
// función para generar un ID único con un length específico
function genId(length) {
	const chars = "aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ";
	let char = "";
	for (let i = 0; i < length; i++) {
		char += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return char;
}
// creo la estrategia para inicio de sesión
passport.use("local.signin", new LocalStrategy({
	usernameField: "username",
	passwordField: "password",
	passReqToCallback: true
}, async (req, username, password, done) => {
	// compruebo si el nombre de usuario existe
	const rows = await connection.query(`SELECT * FROM users WHERE users.username = ?`, [username]);
	if (rows.length > 0) {
		// de existir, procede
		const user = rows[0];
		const passwordMatch = await bcrypt.compare(password, user.password); // compruebo si las contraseñas coínciden
		if (passwordMatch) {
			// si coínciden el usuario es logueado y se le dice que ha iniciado sesión con éxito
			done(null, user, req.flash("success", "Has iniciado sesión con éxito"));
		} else {
			// si no coínciden, le tira un error al usuario
			done(null, false, req.flash("error", `Contraseña incorrecta`));
		}
	}
	else {
		// si no existe, retorna un error diciendo que no existe
		done(null, false, req.flash("error", 'El nombre de usuario introducido es inexistente'));
	}
}));
// estrategia para el registro
passport.use("local.signup", new LocalStrategy({
	usernameField: "username",
	passwordField: "password",
	passReqToCallback: true
}, async (req, username, password, done) => {
	// creo la contraseña encriptada
	const encryptedPass = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
	const gentId = genId(12); // creo el ID único de 12 carácteres
	const { email, fullname } = req.body;
	// creo el objeto del usuario
	const newUser = {
		id: gentId,
		email,
		username,
		fullName: fullname,
		password: encryptedPass,
		isAdmin: "no"
	};
	const foundEmail = await connection.query(`SELECT * FROM users WHERE users.email = '${email}'`);
	const foundUsername = await connection.query(`SELECT * FROM users WHERE users.username = '${username}'`);
	if (foundUsername.length > 0) return done(null, false, req.flash("error", "El nombre de usuario ya está tomado")); // si el nombre de usuario existe, tira error
	else if (foundEmail.length > 0) return done(null, false, req.flash("error", "El email ya está tomado")); // si el email existe, tira error
	await connection.query("INSERT INTO users SET ? ", [newUser]); // Guardo al usuario y le doy un mensaje de bienvenidas
	return done(null, newUser, req.flash("success", "Te has registrado con éxito, bienvenid@!"));
}));
passport.serializeUser((user, done) => {
	done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
	const rows = await connection.query(`SELECT * FROM users WHERE users.id = '${id}'`);
	done(null, rows.length > 0 ? rows[0] : null);
});
module.exports = passport;