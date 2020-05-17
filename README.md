# Source Server Query bot
Don't exactly have a better name for this as of the moment, eitherway this is a pretty slapped together Discord bot built on node.js to poll a source game's server infomation based upon the IP given, and turn it into a pretty attachment generated through canvas.

## Startup
To start the bot up provide the token into corrosponding feild in `config.json`. From there run the bot through node.js with `npm start` on the projects folder

## Commands
|Command| Usage | Example|
|--| -- | -- |
| server | Requests server infomation from the bot, returning it in a embed alongside the provided text from the config | !server |
|blacklist|Will blacklist the channel the command was used in from being able to use user commands|!blacklist
|whitelist|Will remove the blacklist entry fromthe channel the command was used in|!white
|setconfig|Given the correct arguments, will change the config infomations for the given server| !setconfig prefix .|
|showconfig|shows the current server config file|!showconfig|

## Expanding the selection of images
To expand the ammount of images provided for the bot as to avoid it utilising placeholders, you must add them into the following directory

    ServerBot\assets\server\maps
the file names corrospond to the maps name which is taken from an array split at the underscores of the maps string I.E `koth_viaduct_event > [koth,viaduct,event]` This array then looks for a corrosponding JPEG using the value of index 1 to search. In the case like this where the map has an event prefix, event gets appended onto the end of index 1, in this example reading as `viaductevent.jpg`when the file search occours. In the advent of a missing map it will pull from a placeholder found in

    ServerBot\assets\server

## Dependancies
**For enabling the bot to do bot things**
[discord.js](https://www.npmjs.com/package/discord.js)
[enmap](https://www.npmjs.com/package/enmap)
[better-sqlite3](https://www.npmjs.com/package/better-sqlite3)

**Server scraping and making the server scraping look fancy**
[gamedig](https://www.npmjs.com/package/gamedig)
[canvas](https://www.npmjs.com/package/canvas)
