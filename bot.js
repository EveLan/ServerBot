// Source server query bot
//
// Hastily thrown together from the parts of the bot I was mainly working on, contains admin based commands as a precaution to stop it being spammed as heavily
// TODO: Better improve formatting of the players portion of the canvas image. Current array chunking method ends up assorting names into even number columns past 1st line
//       Solve edge case that causes crash when attemtping to trim character count of users who don't exist

const config = require("./config.json")
const Discord = require("discord.js")
const client = new Discord.Client()

const Enmap = require('enmap')
const Gamedig = require('gamedig')
const { registerFont, createCanvas, loadImage } = require('canvas')
registerFont('./assets/fonts/Overpass-bold.ttf', { family: 'Overpass' })

//the only global variable just to store the map, mainly because putting it into the pre existing database is proving to be too painful
let lastMap = ''

client.settings = new Enmap({
    name: "settings",
    fetchAll: false,
    autoFetch: true,
    cloneLevel: 'deep'
});

//default server settings if server config not present
const defaultSettings = {
    prefix: "!",	
    modlog: "mod-log",
    blacklist: [],
}

client.once('ready', async () => {
    console.log('Ready!');
    let channelID = '215966843033223168' // the channel ID you want to have the server update into
    let channel = client.channels.cache.get(channelID)
    let ip = config.ip.split(':');
    let mapUpdate = setInterval(() =>{
        startServerQuery(ip, channel, config.serverMessage, true)
    }, 60000);
    mapUpdate
});

client.on("message", async message => {

    if(!message.guild || message.author.bot) return;

    
    const guildConf = client.settings.ensure(message.guild.id, defaultSettings);
    if(message.content.indexOf(guildConf.prefix) !== 0) return;

    //splits command into set of arguments, moves it to lower case
    const args = message.content.split(/\s+/g);
    const command = args.shift().slice(guildConf.prefix.length).toLowerCase();

    //check if user has administrator perm on server
    let hasAdmin = message.channel.permissionsFor(message.member).has("ADMINISTRATOR", false);

    //whitelist/blacklist commands to stop general commands from being used in set channels
    if(command === "blacklist"){
        if(!hasAdmin === true){
            return message.reply("You're not an admin, sorry!");
        }
        message.channel.send("blacklisting " + message.channel.name + " (" + message.channel.id + ") from general commands");
        let blacklist = guildConf.blacklist;
        blacklist.push(message.channel.id);
        client.settings.set(message.guild.id, blacklist, "blacklist");
    }
    if(command === "whitelist"){
        if(!hasAdmin === true){
            return message.reply("You're not an admin, sorry!");
        }
        message.channel.send("whitelisting " + message.channel.name + " (" + message.channel.id + ") from general commands");
        let blacklist = guildConf.blacklist;
        let index = blacklist.indexOf(message.channel.id);
        if(index > -1){
            blacklist.splice(index, 1)
        }
        client.settings.set(message.guild.id, blacklist, "blacklist");
    }
    if(command === "setconfig") {
        if(!hasAdmin === true){
            return message.reply("You're not an admin, sorry!");
        }
        
        const [prop, ...value] = args;
        if(!client.settings.has(message.guild.id, prop)) {
            return message.reply("This key is not in the config.");
        }
        
        client.settings.set(message.guild.id, value.join(" "), prop);
        message.channel.send(`Server config updated. ${prop} has been changed to: \`${value.join(" ")}\``);
    }
    if(command === "showconfig") {
        if(!hasAdmin === true){
            return message.reply("You're not an admin, sorry!");
        }
n
        let configProps = Object.keys(guildConf).map(prop => {
            return `${prop}: ${guildConf[prop]}`;
        });

        const configEmbed = new Discord.MessageEmbed()
            .setTitle('Current Server Config')
            .setDescription(configProps)
            .setTimestamp();

        client.channels.cache.get(guildConf.modlog).send(configEmbed);
    }
    //general commands - if channel is blacklisted commands do not pass
    if(!guildConf.blacklist.includes(message.channel.id)){
        // The actual command that generates a canvas image
        if (command === "server"){
            let ip = config.ip.split(":");
            startServerQuery(ip, message.channel, config.serverMessage)
        }
    }
});

// query functions
const startServerQuery = async (ip, context, message, checkMap = false) =>{
    Gamedig.query({
        type: 'tf2',
        host: ip[0],
        post: ip[1],
        maxAttempts: '3'
    }).then((state) => {
        // If sucessful in getting server data, enter function carrying over the data pulled from the server (state) and the nessecary context
        //check map switch statement used here as to not flood the specified channel with a new embed every 60 seconds, limiting it to if a change is found in maps.
        switch(checkMap){
            
            case true:
                if(lastMap != state.map){
                    console.log(lastMap);
                    console.log(`${getTimestamp()} Server request sucessful`)
                    lastMap = state.map
                    generateServerInfo(state, context, message)
                }
                break
            case false:
                console.log(`${getTimestamp()} Server request sucessful`)
                generateServerInfo(state, context, message)
                break
        }
    })
    .catch((error) => {
        // If unable to find server, send an error message to the corrosponding channel (Might potentially cause problems for updating server info per map change)
        console.log(`${getTimestamp()} Server request failed, server might be down`)
        if(checkMap != true){
            context.send("Sorry! there was an error in locating the server");
        }
    });
}

const generateServerInfo = async (state, context, message) =>{
    //loops through player list, shrinks player name if too, then chunks them into 4 smaller arrays
    //
    // TODO: Edge case - Fix crash when trying to reduce the name of users who are no longer there (result of joining/leaving right as the command is being utilised)
    //
    let playersList = [];
    let maxLength = 14;
    console.log(`${getTimestamp()} Found ${state.players.length} players out of ${state.maxplayers} on map ${state.map}`);
    for(i = 0; i < state.players.length; i++){
        let tempObj = state.players[i]
        playersList.push(tempObj.name.substring(0,maxLength));
    }
    while(playersList.length < 4){
        playersList.push('\u200B');
    }
    playersList = chunk(playersList, playersList.length / 4);
    //create canvas
    const canvas = createCanvas(500, 370);
    const ctx = canvas.getContext('2d');
    //map backdrop, appends event if found ajacent to map name
    let currentmap = state.map.split('_');
    if(currentmap[2] == 'event'){
        currentmap[1] = currentmap[1] + 'event'
    }
    try{
        const serverbg = await loadImage('./assets/server/maps/' + currentmap[1] + '.jpg');
        let imgScale = calcAspectRatio(1920,1080,500,300);
        ctx.drawImage(serverbg, 0, 0, imgScale.width, imgScale.height);
    }catch(error){
        //if unable to find the map name, set the backdrop as a placeholder image
        console.log(`${getTimestamp()} Map ${state.map} does not have a corrosponding image, using placeholder as fallback`)
        const serverbg = await loadImage('./assets/server/placeholder.jpg');
        let imgScale = calcAspectRatio(1920,1080,500,300);
        ctx.drawImage(serverbg, 0, 0, imgScale.width, imgScale.height);
    }
    //overlay element
    const overlay = await loadImage("./assets/server/overlay.png");
    ctx.drawImage(overlay, 0, 0, 500, 370);
    //text
    ctx.textAlign = "left"; 
    ctx.fillStyle = '#ffffff';
    applyText(ctx, state.map, 28, 8, 72, true);
    applyText(ctx, `Players - ` + state.players.length + '/' + state.maxplayers, 28, 8, 236, true);
    //players list text
    for(i = 0; i < 4; i++){
        applyText(ctx, playersList[i].join('\n'), 14, 8 + (i * 125), 256);
    }
    //generate and send attachment
    console.log(`${getTimestamp()} Attachment Generated, sent to #${context.name}`)
    const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'serverinfo.png');
    return context.send(message, attachment);
}

//array chunker, used to split player list into 4 seperate lists
//
// TODO: Find a way to properly sort array horizontally, current method focuses on even numbers before odd ones.
//
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)    
  );

// calculates aspect ratio of given image, returns object widths and heights to feed into the canvas data
const calcAspectRatio = (srcWidth, srcHeight,maxWidth, maxHeight) =>{
    let ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return { width: srcWidth*ratio, height: srcHeight*ratio };
}

// Used to more effectivily apply text to the canvas elements, with control over the size, co-ordiantes and stroke avaliable.
const applyText = (ctx, content, size, x, y, hasStroke = false) =>{
    ctx.font = size + `px Overpass`
    if(hasStroke){
        ctx.lineWidth = 3
        ctx.strokeText(content, x, y)
    }
    ctx.fillText(content, x, y)
}
//lazily made timestamp gen to help the debugging
const getTimestamp = () =>{
    let stamp = new Date()
    let dd = stamp.getDate()
    let mm = stamp.getMonth()+1
    let yy = stamp.getFullYear()
    let h = stamp.getHours()
    let m = stamp.getMinutes()
    let s = stamp.getSeconds()
    return `[${dd}/${mm}/${yy} | ${h}:${m}:${s}]`
}

client.login(config.token);