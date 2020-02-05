const tpix = require("./tpix-api");
var telegram = require('telegram-bot-api');

var bot = new telegram({
        token: process.env.TOKEN,
        updates: {
        	enabled: true
    }
});

bot.on("message", (msg) => {
    var cmd = commands.find(msg.text);
    if(cmd){
        cmd.exec(msg, msg.text.match(cmd.regexp));
    }
    
    
});

bot.on("update", (upd) => {
	
    if(upd.callback_query){
		var msg = upd.callback_query.message.message_id;
		var query = upd.callback_query.data;
		var chat =  upd.callback_query.message.chat.id;
		var text = upd.callback_query.message.caption.match(/Автор фото: (.+)/i)[0];
		tpix.train.search({query: query, count: 1}).then((res) => {
            if(res.trains){
                tpix.train.get({id: res.trains[0].ID}).then((data) => {
                        
                    text += "\n" + objectCreator.moreInfo(data.train);
                    bot.editMessageCaption({chat_id: chat, message_id: msg, caption: text}); 
     
                });
            }else{
                bot.editMessageCaption({chat_id: chat, message_id: msg, caption: text + "\nНичего не найдено"}); 
            }
        });
		
		
	}
    
});

var users = {};

bot.on('inline.query', (query) => {
    if(query.offset == ""){
        users[query.from.id] = {st: 0};
        query.offset = 0;
    }
    tpix.train.search({query: query.query, count: 10, st: users[query.from.id].st}).then((res) => {
        var resArr = [];
        if(res.trains){
            res.trains.forEach((e, i, a) => {
                if(e.photos){
                    var answer = objectCreator.inlineResult(e);
                    answer.id = i;
                    resArr.push(answer);
                }
            });
        }
        users[query.from.id].st += res.parsed;
        bot.answerInlineQuery({"inline_query_id": query.id, "results": resArr, next_offset: parseInt(query.offset) + 10});
    });
});

var commands = {
    list: [
        {
            regexp: /\/train (.+)/i, 
            name: "/train",
            description: "информация и фото",
            exec: function(msg, args){
                tpix.train.search({query: args[1], count: 1}).then((res) =>{
                    var text = "Ничего не найдено";
                    if(res.trains){
                        text = objectCreator.trainInfo(res.trains[0]);
                    }
                    bot.sendMessage({chat_id: msg.chat.id, text: text, parse_mode: "Markdown"});
                });
            }
        },  {
            regexp: /\/photo (.+)/i, 
            name: "/photo",
            description: "фото",
            exec: function(msg, args){
                tpix.train.search({query: args[1], count: 1}).then((res) =>{
                    
                    if(res.trains && res.trains[0].photos){
                        tpix.photo.get({id: res.trains[0].photos[0].ID}).then((pix) => {
                            photo = pix.photo;
                            bot.sendPhoto({chat_id: msg.chat.id, photo: photo.image, caption: res.trains[0].name + '\nАвтор фото: '+ photo.author, parse_mode: "Markdown"});
                        });
                    }
                    else{
                        bot.sendMessage({chat_id: msg.chat.id, text: "Ничего не найдено", parse_mode: "Markdown"});
                    }
                    
                });
            }  
        },  {
            regexp: /\/random/i, 
            name: "/random",
            description: "фото",
            exec: function(msg, args){
                tpix.photo.random({a: "1"}).then((res) => {
                    bot.sendPhoto({chat_id: msg.chat.id, photo: res.photo.image, caption: res.train.name + '\nАвтор фото: '+ res.photo.author, reply_markup: JSON.stringify(keyboards.random(res.train.name))});
                });
            }
            
        },{
        regexp: /\/start/i,
        exec: (msg) =>{
            
            bot.sendMessage({chat_id: msg.chat.id, text:"Привет, это TrainPix bot.\nИспользуй команды:\n/train {название} - информация и фото поезда\n/photo {название} - фото поезда\n/random - случайное фото\n\nПримеры:\n/photo ЭД4М-0370\n/train ЭД9Т\n\nИнлайн режим: в любом чате введите @tpix_bot и название поезда, чтобы отправить фото в этот чат."});
        
        }
		}
    ],
    
    find: (text) => {
        var res = null;
        commands.list.forEach((e, i, a) => {
            if(text.match(e.regexp)){
                res = e;
                return;
            }
        });
        return res;
    }
};

var objectCreator = {
    inlineResult: (train) => {
        var answer = {type: 'article', parse_mode: "Markdown"};
        answer.message_text = "[" + train.name +"]" + "(" + train.photos[0].image + ")" + " " + state[train.condition] + "\n_" + train.depot.name + "_";
        answer.thumb_url = train.photos[0].thumbnail;
        answer.title = train.name;
        answer.description = state[train.condition];
        return (answer);
    },
    trainInfo: (train) => {
        var res = "";
        if(train.photos) res += "[" + train.name + "](" + train.photos[0].image + ")";
        if(train.railway) res+= "\nДорога приписки: " + train.railway.name;
        if(train.depot) res+= "\nДепо: " + train.depot.name;
        if(train.model) res+= "\nСерия: " + train.model.name;
        if(train.built) res+= "\nПостроен: " + train.built;
        if(train.condition) res+= "\nCостояние: " + state[train.condition];
        if(train.note) res+= "\nПримичание: " + train.note;
        return res;
    },
	moreInfo: (train) => {
		var res = "";
        if(train.photos) res += train.name;
        if(train.railway) res+= "\nДорога приписки: " + train.railway.name;
        if(train.depot) res+= "\nДепо: " + train.depot.name;
        if(train.model) res+= "\nСерия: " + train.model.name;
        if(train.built) res+= "\nПостроен: " + train.built;
        if(train.condition) res+= "\nCостояние: " + state[train.condition];
        if(train.note) res+= "\nПримичание: " + train.note;
		if(train.info) res+= "\n\n" + train.info;
        return res;
	}
};

var keyboards = {
    random: (train) => 
    {
            return({"inline_keyboard": [
                [
                    {"text": "Больше инфы", "callback_data": train}
                ]
            ]});
    }
};

var state = {
    "1": "Эксплуатируется", 
        "2": "Новый", 
        "3": "Не работает",
        "4": "Списан",
        "5": "Утерян",
        "7": "КРП/модернизация",
        "10": "Перенумерован", 
        "6": "Передан в другое депо", 
        "9": "Экспонат"};
