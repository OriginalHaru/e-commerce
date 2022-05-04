/* 
  archivo que contiene las funciones que administran el carrito desde el frontend
  Gran parte de estas funciones utilizan WebSockets para hacer comprobaciones en tiempo real con el servidor
*/
// función para generar un string con un length específico
function genString(length) {
	const chars = "aAbBcCdDeEfFgGhHiIjJkK";
	let char = "";
	for (let i = 0; i < length; i++) {
		char += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return char;
}
// función para añadir un producto al carrito
async function addProduct(productId, userId, buttonId) {
	const btn = document.getElementById(buttonId);
	const userCart = window.localStorage.getItem("cart");
	log("info", "Sending check-product event to the server to check if the product exists...");
	const gentToken = genString(10);
	await socket.emit("check-product", {
		productId: productId,
		uniqueToken: gentToken
	});
	log("info", "Event sent, waiting for response...");
	socket.on("check-product-response", async product => {
		if (product.uniqueToken !== gentToken) return;
		log("info", "Response received");
		if (!product.exists) {
			return window.alert(`Unknown Product`);
		}
		else {
			if (product.data.stock < 1) return alert("Product out of stock");
			socket.emit("get-cart", {
				userid: userId
			});
			btn.innerHTML = "Loading...";
			btn.disabled = true;
			socket.on("get-cart-response", async data => {
				if (data.cartExists) {
					if (!userCart) {
						const cObject = JSON.parse(data.cartData);
						if (cObject.items.filter(p => p.id === product.data.id).length === product.data.length) return alert(`Product out of stock`);
						cObject.items.push(product.data);
						window.localStorage.setItem("cart", JSON.stringify(cObject));
						socket.emit("store-cart", {
							userid: userId,
							cartData: JSON.stringify(cObject)
						});
					}
					else {
						const cObject = JSON.parse(data.cartData);
						if (cObject.items.filter(p => p.id === product.data.id).length === product.data.length) return alert(`Product out of stock`);
						cObject.items.push(product.data);
						window.localStorage.setItem("cart", JSON.stringify(cObject));
						socket.emit("store-cart", {
							userid: userId,
							cartData: JSON.stringify(cObject)
						});
					}
				} else {
					if (!userCart) {
						const cObject = {
							userid: userId,
							items: [product.data]
						};
						window.localStorage.setItem("cart", JSON.stringify(cObject));
						socket.emit("store-cart", {
							userid: userId,
							cartData: JSON.stringify(cObject)
						});
					}
					else {
						const cObject = JSON.parse(userCart);
						cObject.items.push(product.data);
						window.localStorage.setItem("cart", JSON.stringify(cObject));
						socket.emit("store-cart", {
							userid: userId,
							cartData: JSON.stringify(cObject)
						});
					}
				}
				btn.innerHTML = "success";
				setTimeout(() => {
					btn.innerHTML = "Añadir al carrito";
					btn.disabled = false;
				}, 2000);
			});
		}
	});
}
// función que se ejecuta siempre en cualquier ruta, se encarga de comprobar que la info del carrito almacenada en el LocalStorage sea válida y se sincronize con la base de datos
async function checkCart(userId) {
	const cart = window.localStorage.getItem("cart");
	const uniqueToken = genString(10);
	if (cart) {
		const cartObject = JSON.parse(cart);
		if (cartObject.userid !== userId) {
			log("info", "User ID and carts user ID does not match, removing cart from LocalStorage...");
			window.localStorage.clear();
			log("success", "Cart removed");
		}
		else {
			log("info", "User ID and carts user ID matches, updating cart...");
			socket.emit("get-cart", { userid: userId, uniqueToken });
			socket.on("get-cart-response", async data => {
				if (data.uniqueToken !== uniqueToken) return;
				if (data.cartExists) {
					window.localStorage.setItem("cart", data.cartData);
					log("info", "Updated cart");
				}
			});
		}
	}
	else if (!cart) {
		socket.emit("get-cart", {
			userid: userId,
			uniqueToken
		});
		socket.on("get-cart-response", async data => {
			if (data.uniqueToken !== uniqueToken) return;
			if (data.cartExists) {
				log("info", "Updated cart");
				window.localStorage.setItem("cart", data.cartData);
			}
		});
	}
}
// función para comprobar y remover items inválidos del carrito
async function checkCartItems(userId) {
	log("info", "Removing invalid items...");
	let cart = window.localStorage.getItem("cart");
	const uniqueToken = genString(10);
	socket.emit("get-cart", {
		userid: userId,
		uniqueToken
	});
	socket.on("get-cart-response", async data => {
		if (data.uniqueToken !== uniqueToken) return;
		if (!data.cartExists) return;
		cart = JSON.parse(data.cartData);
		window.localStorage.setItem("cart", data.cartData);
		socket.emit("check-products", {
			items: cart.items,
			uniqueToken: uniqueToken
		});
		socket.on("check-products-response", async data => {
			if (data.uniqueToken !== uniqueToken) return;
			if (data.removedLength < 1) return log("info", "0 Invalid items found");
			cart.items = data.items;
			window.localStorage.setItem("cart", JSON.stringify(cart));
			socket.emit("store-cart", {
				userid: userId,
				cartData: JSON.stringify(cart)
			});
			log("info", `Removed ${data.removedLength} invalid items from cart`);
		});
	});
}
// función que carga la info del carrito en la ruta /cart
async function loadCartData(loadingId) {
	const loadingDiv = document.getElementById(loadingId);
	const cart = JSON.parse(window.localStorage.getItem("cart"));
	log("info", "Loading cart...");
	const containerDiv = document.createElement("div");
	containerDiv.setAttribute("class", "container p-4");
	containerDiv.id = "main-container-div";
	const cardDiv = document.createElement("div");
	cardDiv.setAttribute("class", "card md-4 text-center");
	containerDiv.appendChild(cardDiv);
	const cardHeaderDiv = document.createElement("div");
	cardHeaderDiv.setAttribute("class", "card-header");
	if (!cart) {
		const cartP = document.createElement("h3");
		cartP.innerText = "Carrito";
		cardHeaderDiv.appendChild(cartP);
		const cardBodyDiv = document.createElement("div");
		cardBodyDiv.setAttribute("class", "card-body");
		const noItem = document.createElement("h5");
		noItem.innerText = "No hay productos de momento en el carrito";
		const exploreA = document.createElement("a");
		exploreA.href = "/";
		exploreA.setAttribute("class", "btn btn-primary");
		exploreA.innerText = "Ir a explorar";
		cardBodyDiv.appendChild(noItem);
		cardBodyDiv.appendChild(exploreA);
		cardDiv.appendChild(cardHeaderDiv);
		cardDiv.appendChild(cardBodyDiv);
		document.body.removeChild(loadingDiv);
		document.title = "Cart";
		document.body.appendChild(containerDiv);
		return log("info", "Cart info loaded");
	}
	const cartP = document.createElement("h3");
	cartP.innerText = "Carrito";
	cardHeaderDiv.appendChild(cartP);
	cardDiv.appendChild(cardHeaderDiv);
	const cardBodyDiv = document.createElement("div");
	cardBodyDiv.setAttribute("class", "card-body");
	for (const item of cart.items) {
		const itemDataDiv = document.createElement("div");
		itemDataDiv.setAttribute("id", `item-${item.id}-data`);
		const nameH = document.createElement("h3");
		nameH.innerText = `${item.name}`;
		const pElement = document.createElement("p");
		pElement.innerText = `Precio: ${item.price}`;
		const br = document.createElement("br");
		itemDataDiv.appendChild(nameH);
		itemDataDiv.appendChild(br);
		itemDataDiv.appendChild(pElement);
		cardBodyDiv.appendChild(itemDataDiv);
	}
	const btnGroupDiv = document.createElement("div");
	btnGroupDiv.setAttribute("class", "btn-group");
	btnGroupDiv.setAttribute("role", "group");
	const btnRemoveItems = document.createElement("button");
	btnRemoveItems.setAttribute("class", "btn btn-danger");
	btnRemoveItems.innerText = "Remover items";
	btnRemoveItems.onclick = function () {
		btnRemoveItems.disabled = true;
		btnRemoveItems.innerText = "Loading...";
		cart.items = [];
		window.localStorage.setItem("cart", JSON.stringify(cart));
		socket.emit("store-cart", {
			userid: cart.userid,
			cartData: JSON.stringify(cart)
		});
		setTimeout(() => {
			reloadCart(containerDiv);
		}, 2000);
	}
	const form = document.createElement("form");
	form.action = "/pay";
	form.method = "POST";
	const btnContinue = document.createElement("button");
	btnContinue.setAttribute("class", "btn btn-success");
	btnContinue.innerText = "Pagar";
	form.appendChild(btnContinue);
	const inputId = document.createElement("input");
	inputId.hidden = true;
	inputId.value = cart.userid;
	inputId.name = "userid";
	const inputLength = document.createElement("input");
	inputLength.hidden = true;
	inputLength.value = cart.items.length;
	inputLength.name = "itemsLength";
	form.appendChild(inputId);
	form.appendChild(inputLength)
	if (cart.items.length > 0) {
		const inputPrices = document.createElement("input");
		const total = cart.items.length < 2 ? cart.items[0].price : cart.items.reduce((a, b) => {
			return a.price + b.price;
		});
		console.log(total);
		inputPrices.hidden = true;
		inputPrices.name = "total";
		inputPrices.value = String(total);
		form.appendChild(inputPrices);
		btnGroupDiv.appendChild(form);
		btnGroupDiv.appendChild(btnRemoveItems);
		cardBodyDiv.appendChild(btnGroupDiv);
	} else {
		const noItem = document.createElement("h5");
		noItem.innerText = "No hay productos de momento en el carrito";
		const exploreA = document.createElement("a");
		exploreA.href = "/";
		exploreA.setAttribute("class", "btn btn-primary");
		exploreA.innerText = "Ir a explorar";
		cardBodyDiv.appendChild(noItem);
		cardBodyDiv.appendChild(exploreA);
	}
	cardDiv.appendChild(cardBodyDiv);
	document.body.removeChild(loadingDiv);
	document.title = "Cart";
	document.body.appendChild(containerDiv);
	log("info", "Cart info loaded");
}
// función que recarga la info del carrito en la ruta /cart, usualmente cuando se le da al botón de remover items
async function reloadCart(mainContainer) {
	const uniqueToken = genString(10);
	const img = document.createElement("img");
	img.src = "https://c.tenor.com/tEBoZu1ISJ8AAAAC/spinning-loading.gif";
	const newDiv = document.createElement("div");
	newDiv.setAttribute("class", "text-center");
	newDiv.id = "loading-gif-div";
	newDiv.appendChild(img);
	const script = document.createElement("script");
	script.innerHTML = "setTimeout(() => loadCartData('loading-gif-div'), 4000)";
	socket.emit("get-cart", {
		userid: JSON.parse(window.localStorage.getItem("cart")).userid,
		uniqueToken
	});
	socket.on("get-cart-response", async data => {
		if (data.uniqueToken !== uniqueToken) return;
		if (!data.cartExists) return window.location.reload();
		window.localStorage.setItem("cart", data.cartData);
		socket.emit("store-cart", {
			userid: JSON.parse(window.localStorage.getItem("cart")).userid,
			cartData: data.cartData
		});
		document.body.removeChild(mainContainer);
		document.body.appendChild(newDiv);
		document.body.appendChild(script);
		document.title = "Loading...";
	});
}