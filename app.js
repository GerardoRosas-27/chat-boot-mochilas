/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */
require('dotenv').config()
const fs = require('fs');
const express = require('express');
const cors = require('cors')
const qrcode = require('qrcode-terminal');
const { Client, Buttons } = require('whatsapp-web.js');
const mysqlConnection = require('./config/mysql')
const { middlewareClient } = require('./middleware/client')
const { generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle')
const { connectionReady, connectionLost } = require('./controllers/connection')
const { saveMedia } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows')
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, readChat } = require('./controllers/send')
const app = express();
app.use(cors())
app.use(express.json())
app.use(express.static('imagenes'));
const MULTI_DEVICE = process.env.MULTI_DEVICE || 'true';
const server = require('http').Server(app)

const port = process.env.PORT || 3000
const SESSION_FILE_PATH = './session.json';
var client;
var sessionData;

var activeBoot = true;

app.use('/', require('./routes/web'))


app.get('/imagenes/:img', function (req, res) {
    res.sendFile(__dirname + `/imagenes/${req.params.img}`);
});
/**
 * Escuchamos cuando entre un mensaje
 */
const listenMessage = () => client.on('message', async msg => {
    console.log("client inital: ", msg)
    const { from, body, hasMedia } = msg;

    if (!isValidNumber(from)) {
        return
    }

    // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
    if (from === 'status@broadcast') {
        return
    }
    message = body.toLowerCase();
    console.log('BODY', message)
    const number = cleanNumber(from)
    await readChat(number, message)

    /**
     * Guardamos el archivo multimedia que envia
     */
    if (process.env.SAVE_MEDIA && hasMedia) {
        console.log("entro save media");
        const media = await msg.downloadMedia();
        saveMedia(media);
    }

    /**
     * Si estas usando dialogflow solo manejamos una funcion todo es IA
     */

    if (process.env.DATABASE === 'dialogflow') {
        if (!message.length) return;
        const response = await bothResponse(message);
        await sendMessage(client, from, response.replyMessage);
        if (response.media) {
            sendMedia(client, from, response.media);
        }
        return
    }

    /**
    * Ver si viene de un paso anterior
    * Aqui podemos ir agregando más pasos
    * a tu gusto!
    */

    let lastTrigger = ""

    /**
     * Respondemos al primero paso si encuentra palabras clave
     */
    let step = await getMessages(message);

    if (step) {
        if (step === "STEP_1") {
            activeBoot = true;
            console.log("entro activeBoot true: ", activeBoot);
        }
        if (activeBoot) {
            do {
                let result = await stepSendMessage(client, from, lastTrigger ? lastTrigger : step);
                lastTrigger = result.trigger;
            } while (lastTrigger);
        }
        return
    }

    console.log("activeBoot: ", activeBoot);
    //Si quieres tener un mensaje por defecto
    if (process.env.DEFAULT_MESSAGE === 'true' && activeBoot) {
        const response = await responseMessages('DEFAULT')
        await sendMessage(client, from, response.replyMessage, response.trigger);

        /**
         * Si quieres enviar botones
         */
        if (response.hasOwnProperty('actions')) {
            const { actions } = response;
            await sendMessageButton(client, from, null, actions);
        }
        return
    }
});
const stepSendMessage = async (client, from, step) => {

    let response = await responseMessages(step);
    console.log("response trigger: ", response.trigger);

    if (step === "STEP_0") {
        activeBoot = false;
        console.log("entro activeBoot false: ", activeBoot);
    }
    await sendMessage(client, from, response.replyMessage, response.trigger);
    /**
       * Si quieres enviar botones
       */
    if (response.hasOwnProperty('actions')) {
        const { actions } = response;

        const { title = null, message = null, footer = null, buttons = [] } = actions;
        let button = new Buttons(message, [...buttons], title, footer);
        console.log("enviar bottons: ", { from, button });
        let responsB = await client.sendMessage(from, button);
        console.log("response bootons: ", responsB);
        return { trigger: response.trigger }
    }

    if (response.media) {
        await sendMedia(client, from, response.media);
        return { trigger: response.trigger }
    } 
   return { trigger: response.trigger }
    
}

/**
 * Revisamos si tenemos credenciales guardadas para inciar sessio
 * este paso evita volver a escanear el QRCODE
 */
const withSession = () => {
    console.log(`Validando session con Whatsapp...`)
    sessionData = require(SESSION_FILE_PATH);
    client = new Client(createClient(sessionData, true));

    client.on('ready', () => {
        connectionReady()
        listenMessage();
    });

    client.on('auth_failure', () => connectionLost())

    client.initialize();
}

/**
 * Generamos un QRCODE para iniciar sesion
 */
const withOutSession = () => {
    console.log('No tenemos session guardada');
    console.log([
        '🙌 El core de whatsapp se esta actualizando',
        '🙌 para proximamente dar paso al multi-device',
        '🙌 falta poco si quieres estar al pendiente unete',
        '🙌 http://t.me/leifermendez',
        '🙌 Si estas usando el modo multi-device se generan 2 QR Code escanealos',
        '🙌 Ten paciencia se esta generando el QR CODE',
        '________________________',
    ].join('\n'));

    client = new Client(createClient());

    client.on('qr', qr => generateImage(qr, () => {
        qrcode.generate(qr, { small: true });
        console.log(`Ver QR http://localhost:${port}/qr`)
        socketEvents.sendQR(qr)
    }))

    client.on('ready', (a) => {
        connectionReady()
        listenMessage()
        // socketEvents.sendStatus(client)
    });

    client.on('auth_failure', (e) => {
        // console.log(e)
        // connectionLost()
    });

    client.on('authenticated', (session) => {
        sessionData = session;
        if (sessionData) {
            fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
                if (err) {
                    console.log(`Ocurrio un error con el archivo: `, err);
                }
            });
        }
    });

    client.initialize();
}

/**
 * Revisamos si existe archivo con credenciales!
 */
(fs.existsSync(SESSION_FILE_PATH) && MULTI_DEVICE === 'false') ? withSession() : withOutSession();

/**
 * Verificamos si tienes un gesto de db
 */

if (process.env.DATABASE === 'mysql') {
    mysqlConnection.connect()
}

server.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
})
checkEnvFile();

