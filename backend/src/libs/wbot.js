const qrCode = require("qrcode-terminal");
const { Client } = require("whatsapp-web.js");
const Whatsapp = require("../models/Whatsapp");
const { getIO } = require("../libs/socket");

let sessions = [];

module.exports = {
	init: async dbSession => {
		const io = getIO();
		const sessionName = dbSession.name;
		let sessionCfg;

		if (dbSession && dbSession.session) {
			sessionCfg = JSON.parse(dbSession.session);
		}

		const sessionIndex = sessions.findIndex(s => s.id === dbSession.id);
		if (sessionIndex !== -1) {
			sessions[sessionIndex].destroy();
			sessions.splice(sessionIndex, 1);
		}

		const wbot = new Client({
			session: sessionCfg,
			restartOnAuthFail: true,
		});
		wbot.initialize();

		wbot.on("qr", async qr => {
			console.log("Session:", sessionName);

			qrCode.generate(qr, { small: true });

			await dbSession.update({ id: 1, qrcode: qr, status: "qrcode" });

			io.emit("session", {
				action: "update",
				session: dbSession,
			});
		});

		wbot.on("authenticated", async session => {
			console.log("Session:", sessionName, "AUTHENTICATED");

			await dbSession.update({
				session: JSON.stringify(session),
				status: "authenticated",
			});

			io.emit("session", {
				action: "update",
				session: dbSession,
			});
		});

		wbot.on("auth_failure", async msg => {
			console.error("Session:", sessionName, "AUTHENTICATION FAILURE", msg);

			await dbSession.update({ session: "" });
		});

		wbot.on("ready", async () => {
			console.log("Session:", sessionName, "READY");

			await dbSession.update({
				status: "CONNECTED",
				qrcode: "",
			});

			io.emit("session", {
				action: "update",
				session: dbSession,
			});

			// const chats = await wbot.getChats(); // pega as mensagens nao lidas (recebidas quando o bot estava offline)
			// let unreadMessages;                  // todo > salvar isso no DB pra mostrar no frontend
			// for (let chat of chats) {
			// 	if (chat.unreadCount > 0) {
			// 		unreadMessages = await chat.fetchMessages({
			// 			limit: chat.unreadCount,
			// 		});
			// 	}
			// }

			// console.log(unreadMessages);
			wbot.sendPresenceAvailable();
		});

		wbot.id = dbSession.id;
		sessions.push(wbot);

		return null;
	},

	getWbot: sessionId => {
		console.log(sessionId);
		console.log(sessions.map(session => session.id));
		const sessionIndex = sessions.findIndex(s => s.id === sessionId);

		if (sessionIndex === -1) {
			throw new Error("This Wbot session is not initialized");
		}
		return sessions[sessionIndex];
	},
};
