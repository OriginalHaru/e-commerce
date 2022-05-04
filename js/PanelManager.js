// archivo que maneja algunas funciones del panel
// esta comprueba el input de confirmación de la ruta /panel/deleteusers
async function checkConfirmInput(e, confirmInputId, btnId) {
	const btn = document.getElementById(btnId);
	const confirmInput = document.getElementById(confirmInputId);
	if (confirmInput.value.toLowerCase() === "acepto las consecuencias que esto conlleva") {
		btn.disabled = false;
	}
	else {
		btn.disabled = true;
	}
}
// función que se encarga de enviar el form para eliminar al usuario
async function sendDeleteUserForm(formId ,hiddenInputId, idInputId) {
	const formBtn = document.getElementById(formId);
	const hiddenInput = document.getElementById(hiddenInputId);
	const idInput = document.getElementById(idInputId);
	hiddenInput.value = idInput.value;
	formBtn.disabled = false;
	formBtn.click();
}