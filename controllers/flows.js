const {get, reply, getIA} = require('../adapter')
const {saveExternalFile, checkIsUrl} = require('./handle')

const getMessages = async (message) => {
    const data = await get(message)
    return data
}

const responseMessages = async (step) => {
    const data = await reply(step)
    if(data && data.media){
        console.log("url media: ", data.media);
        //const file = await saveExternalFile(data.media);
        const file = data.media;
        console.log("responseMessages media: ", {...data,...{media:file}});
        return {...data,...{media:file}}
    }
    console.log("responseMessages: ", data);
    return data
}

const bothResponse = async (message) => {
    const data = await getIA(message)
    if(data && data.media){
        const file = await saveExternalFile(data.media)
        return {...data,...{media:file}}
    }
    return data
}


module.exports = { getMessages, responseMessages, bothResponse }