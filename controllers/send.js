
const ExcelJS = require('exceljs');
const moment = require('moment');
const fs = require('fs');
const { MessageMedia, Buttons } = require('whatsapp-web.js');
const { cleanNumber } = require('./handle')
const DELAY_TIME = 170; //ms
const DIR_MEDIA = `${__dirname}/../mediaSend`;
// import { Low, JSONFile } from 'lowdb'
// import { join } from 'path'
const { saveMessage } = require('../adapter')
/**
 * Enviamos archivos multimedia a nuestro cliente
 * @param {*} number 
 * @param {*} fileName 
 */

const sendMedia = async (client, number, fileName) => {
    number = cleanNumber(number)
    const file = `${DIR_MEDIA}/${fileName}`;
    if (fs.existsSync(file)) {
        const media = MessageMedia.fromFilePath(file);
        console.log("mensaje: ", { number, media });
        await client.sendMessage(number, media, { sendAudioAsVoice: false });
        return
    }
    return
}

/**
 * Enviamos archivos como notas de voz
 * @param {*} number 
 * @param {*} fileName 
 */

const sendMediaVoiceNote = (client, number, fileName) => {
    number = cleanNumber(number)
    const file = `${DIR_MEDIA}/${fileName}`;
    if (fs.existsSync(file)) {
        const media = MessageMedia.fromFilePath(file);
        client.sendMessage(number, media, { sendAudioAsVoice: true });
    }
}

/**
 * Enviamos un mensaje simple (texto) a nuestro cliente
 * @param {*} number 
 */
const sendMessage = async (client, number = null, text = null, trigger = null) => {

    number = cleanNumber(number)
    const message = text
    console.log("mensaje simple: ", message)
    await client.sendMessage(number, message)
    console.log(`⚡⚡⚡ Enviando mensajes....`);
    await readChat(number, message, trigger)
    console.log(`⚡⚡⚡ Guardando mensajes....`);
    return
}

/**
 * Enviamos un mensaje con buttons a nuestro cliente
 * @param {*} number 
 */
const sendMessageButton = async (client, number = null, text = null, actionButtons) => {
    number = cleanNumber(number)
    const { title = null, message = null, footer = null, buttons = [] } = actionButtons;
    let button = new Buttons(message, [...buttons], title, footer);
    client.sendMessage(number, button);

    console.log(`⚡⚡⚡ Enviando mensajes....`);
}


/**
 * Opte
 */
const lastTrigger = (number) => new Promise((resolve, reject) => {
    number = cleanNumber(number)
    const pathExcel = `${__dirname}/../chats/${number}.xlsx`;
    const workbook = new ExcelJS.Workbook();
    if (fs.existsSync(pathExcel)) {
        workbook.xlsx.readFile(pathExcel)
            .then(() => {
                const worksheet = workbook.getWorksheet(1);
                const lastRow = worksheet.lastRow;
                const getRowPrevStep = worksheet.getRow(lastRow.number);
                const lastStep = getRowPrevStep.getCell('C').value;
                resolve(lastStep)
            });
    } else {
        resolve(null)
    }
})

/**
 * Guardar historial de conversacion
 * @param {*} number 
 * @param {*} message 
 */
const readChat = async (number, message, trigger = null) => {
    number = cleanNumber(number)
    await saveMessage(message, trigger, number)
    console.log('Saved')
}

module.exports = { sendMessage, sendMedia, lastTrigger, sendMessageButton, readChat, sendMediaVoiceNote }