"use strict";
const senha = "#8745";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeWbot = exports.getWbot = exports.initWbot = void 0;
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const whatsapp_web_js_1 = require("whatsapp-web.js");
const {MessageMedia} = require("whatsapp-web.js");
const socket_1 = require("./socket");
const AppError_1 = __importDefault(require("../errors/AppError"));
const logger_1 = require("../utils/logger");
const wbotMessageListener_1 = require("../services/WbotServices/wbotMessageListener");
const sessions = [];
const https = require('https');
const axios = require('axios');
const fs = require('fs');
const mysql = require('mysql');
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "sjnet",
    charset: "utf8mb4"
    });
// ################# DADOS DO PROVEDOR #####################

const url = 'https://sjnetfibra.rbfull.com.br/api/ura/v1/';
const urlv2 = 'https://sjnetfibra.rbfull.com.br/api/v2/';

const token = '7a7e3cf8b6ead05f2a26d6ac0ff79a30';

// #########################################################    
const syncUnreadMessages = (wbot) => __awaiter(void 0, void 0, void 0, function* () {
    const chats = yield wbot.getChats();
    /* eslint-disable no-restricted-syntax */
    /* eslint-disable no-await-in-loop */
    for (const chat of chats) {
        if (chat.unreadCount > 0) {
            const unreadMessages = yield chat.fetchMessages({
                limit: chat.unreadCount
            });
            for (const msg of unreadMessages) {
                yield wbotMessageListener_1.handleMessage(msg, wbot);
            }
            yield chat.sendSeen();
        }
    }
});
exports.initWbot = (whatsapp) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        try {
            const io = socket_1.getIO();
            const sessionName = whatsapp.name;
            let sessionCfg;
            if (whatsapp && whatsapp.session) {
                sessionCfg = JSON.parse(whatsapp.session);
            }
            const wbot = new whatsapp_web_js_1.Client({
                session: sessionCfg,
                authStrategy: new whatsapp_web_js_1.LocalAuth({ clientId: 'bd_' + whatsapp.id }),
                puppeteer: {
                    //          headless: false,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    executablePath: process.env.CHROME_BIN || undefined
                },
            });
            wbot.initialize();
            wbot.on("qr", (qr) => __awaiter(void 0, void 0, void 0, function* () {
                logger_1.logger.info("Session:", sessionName);
                qrcode_terminal_1.default.generate(qr, { small: true });
                yield whatsapp.update({ qrcode: qr, status: "qrcode", retries: 0 });
                const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
                if (sessionIndex === -1) {
                    wbot.id = whatsapp.id;
                    sessions.push(wbot);
                }
                io.emit("whatsappSession", {
                    action: "update",
                    session: whatsapp
                });
            }));
            wbot.on("authenticated", (session) => __awaiter(void 0, void 0, void 0, function* () {
                logger_1.logger.info(`Session: ${sessionName} AUTHENTICATED`);
                //        await whatsapp.update({
                //          session: JSON.stringify(session)
                //        });
            }));
            wbot.on("auth_failure", (msg) => __awaiter(void 0, void 0, void 0, function* () {
                console.error(`Session: ${sessionName} AUTHENTICATION FAILURE! Reason: ${msg}`);
                if (whatsapp.retries > 1) {
                    yield whatsapp.update({ session: "", retries: 0 });
                }
                const retry = whatsapp.retries;
                yield whatsapp.update({
                    status: "DISCONNECTED",
                    retries: retry + 1
                });
                io.emit("whatsappSession", {
                    action: "update",
                    session: whatsapp
                });
                reject(new Error("Error starting whatsapp session."));
            }));
            wbot.on("ready", () => __awaiter(void 0, void 0, void 0, function* () {
                logger_1.logger.info(`Session: ${sessionName} PRONTO`);
                yield whatsapp.update({
                    status: "CONNECTED",
                    qrcode: "",
                    retries: 0
                });
                wbot.on('message', async msg => {
// #################################### INICIO DO BOT ########################################


//PROMESSA DE PAGAMENTO
function PromPag(url, token, cpfcnpj){
    axios.post(url+"consultacliente?token="+token+"&cpfcnpj="+cpfcnpj).then(function(resposta){
      axios.post(url+"liberacaopromessa?token="+token+"&contrato="+resposta.data.assinantes[-0].contratoId).then(function(resdesb){
          //Liberado comSucesso
            connection.query("SELECT * from respostas where nome = 'FINALIZAR'", function (err, WhatsMsg) {
                wbot.sendMessage(msg.from,'*'+resposta.data.assinantes[-0].razaoSocial+'*\n\n'+resdesb.data.data.msg+'\n\n'+WhatsMsg[0].msg);
                connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
            });
      }).catch(function(error){
        if(error){
          connection.query("select * from respostas where nome = 'INFO-DESBLOQUEIO-NEGADO'", function (err, WhatsBotMsg) {
            connection.query("select * from respostas where nome = 'FINALIZAR'", function (err, WhatsMsg) {
                wbot.sendMessage(msg.from, '*'+resposta.data.assinantes[-0].razaoSocial+'*\n\n'+WhatsBotMsg[0].msg+'\n\n'+WhatsMsg[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        });});
                                }})
        }).catch(function(error){
          if(error){
              connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
                  }})
      }
  
    // ############################################################################################

//SEGUNDAVIAFAT

// CLIENTE COM FATURAS EM ABERTO
function SegundaVia(url, token, cpfcnpj, cliente_id){
    axios.post(url+"consultacliente?token="+token+"&cpfcnpj="+cpfcnpj).then(function(resposta){
      axios.post(url+"enviarfatura?token="+token+"&contrato="+resposta.data.assinantes[-0].contratoId).then(function(res2via){
        axios.post("https://sjnetfibra.rbfull.com.br/api/v2/faturas?token=7a7e3cf8b6ead05f2a26d6ac0ff79a30&apenas_nao_pagas=1&retornar_pix=1&id_assinante="+resposta.data.assinantes[-0].contratoId).then(function(res2via2){
            var $dia = res2via2.data.faturas[-0].data_vencimento.substr(-2);
            var $mes = res2via2.data.faturas[-0].data_vencimento.substr(5, 2);
            var $ano = res2via2.data.faturas[-0].data_vencimento.substr(0, 4);
            var $data_vencimento = $dia+'/'+$mes+'/'+$ano;
            var $valor = res2via2.data.faturas[-0].valor;
            console.log($valor);

        connection.query("UPDATE cliente SET nome = '"+resposta.data.assinantes[-0].razaoSocial+"', cpfcnpj = '"+resposta.data.assinantes[-0].cpfCnpj+"', contratoId = '"+resposta.data.assinantes[-0].contratoId+"', contratoStatusDisplay = '"+resposta.data.assinantes[-0].contratoStatusDisplay+"', ultimaFat = '"+res2via2.data.faturas[-0].link+"', ultimaFat_venc = '"+$data_vencimento+"', ultimaFat_valor = '"+$valor+"', pix_brcode = '"+res2via2.data.faturas[-0].pix_brcode+"', categoria = '3' WHERE id = '"+cliente_id+"'");
        if(resposta.data.assinantes[-0].contratoStatusDisplay === "Bloqueado"){
            wbot.sendMessage(msg.from,"Cliente: *" + resposta.data.assinantes[-0].razaoSocial + "*\nContrato: *" + resposta.data.assinantes[-0].contratoId + "*\nStatus: *" + resposta.data.assinantes[-0].contratoStatusDisplay + "*\n\nPor Favor, escolha uma das *opções* abaixo:\n1️⃣ *2 Via Fatura*\n2️⃣ *Desb. Confiança*(Desbloqueio por 72horas)\n\nEscolha uma das *opções* abaixo para falar com um de nossos *Atendentes*:\n3️⃣ *Falar com Comercial*\n4️⃣ *Falar com Financeiro*\n5️⃣ *Falar com Suporte*\n\n_*Acesse Central:*_\n*https://sjnetfibra.rbfull.com.br/central/*\n_(basta informa seu *CPF*)_\n\n0️⃣ *Encerrar Atendimento*");
            connection.query("UPDATE cliente SET nome = '"+resposta.data.assinantes[-0].razaoSocial+"', cpfcnpj = '"+resposta.data.assinantes[-0].cpfCnpj+"', contratoId = '"+resposta.data.assinantes[-0].contratoId+"', contratoStatusDisplay = '"+resposta.data.assinantes[-0].contratoStatusDisplay+"', ultimaFat = '"+res2via2.data.faturas[-0].link+"', ultimaFat_venc = '"+$data_vencimento+"', ultimaFat_valor = '"+$valor+"', pix_brcode = '"+res2via2.data.faturas[-0].pix_brcode+"', categoria = '4' WHERE id = '"+cliente_id+"'");
        console.log(resposta.data.assinantes[-0]);
        }
        else{
            wbot.sendMessage(msg.from,"Cliente: *" + resposta.data.assinantes[-0].razaoSocial + "*\nContrato: *" + resposta.data.assinantes[-0].contratoId + "*\nStatus: *" + resposta.data.assinantes[-0].contratoStatusDisplay + "*\n\nPor Favor, escolha uma das *opções* abaixo:\n1️⃣ *2 Via Fatura*\n\nEscolha uma das *opções* abaixo para falar com um de nossos *Atendentes*:\n3️⃣ *Falar com Comercial*\n4️⃣ *Falar com Financeiro*\n5️⃣ *Falar com Suporte*\n\n_*Acesse Central:*_\n*https://sjnetfibra.rbfull.com.br/central/*\n_(basta informa seu *CPF*)_\n\n0️⃣ *Encerrar Atendimento*");
            connection.query("UPDATE cliente SET nome = '"+resposta.data.assinantes[-0].razaoSocial+"', cpfcnpj = '"+resposta.data.assinantes[-0].cpfCnpj+"', contratoId = '"+resposta.data.assinantes[-0].contratoId+"', contratoStatusDisplay = '"+resposta.data.assinantes[-0].contratoStatusDisplay+"', ultimaFat = '"+res2via2.data.faturas[-0].link+"', ultimaFat_venc = '"+$data_vencimento+"', ultimaFat_valor = '"+$valor+"', pix_brcode = '"+res2via2.data.faturas[-0].pix_brcode+"', categoria = '3' WHERE id = '"+cliente_id+"'");
        }
    }).catch(function(error){
        if(error){
            console.log("SEM FATURAS");
            connection.query("UPDATE cliente SET nome = '"+resposta.data.assinantes[-0].razaoSocial+"', cpfcnpj = '"+resposta.data.assinantes[-0].cpfCnpj+"', contratoId = '"+resposta.data.assinantes[-0].contratoId+"', contratoStatusDisplay = '"+resposta.data.assinantes[-0].contratoStatusDisplay+"', ultimaFat = '"+res2via2.data.faturas[-0].link+"', ultimaFat_venc = '"+$data_vencimento+"', pix_brcode = '"+res2via2.data.faturas[-0].pix_brcode+"', categoria = '3' WHERE id = '"+cliente_id+"'");
            wbot.sendMessage(msg.from,"Cliente: *" + resposta.data.assinantes[-0].razaoSocial + "*\nContrato: *" + resposta.data.assinantes[-0].contratoId + "*\nStatus: *" + resposta.data.assinantes[-0].contratoStatusDisplay + "*\n\nPor Favor, escolha uma das *opções* abaixo:\n1️⃣ *2 Via Fatura*\n\nEscolha uma das *opções* abaixo para falar com um de nossos *Atendentes*:\n3️⃣ *Falar com Comercial*\n4️⃣ *Falar com Financeiro*\n5️⃣ *Falar com Suporte*\n\n_*Acesse Central:*_\n*https://sjnetfibra.rbfull.com.br/central/*\n_(basta informa seu *CPF*)_\n\n0️⃣ *Encerrar Atendimento*");
        }})
        }).catch(function(error){
          if(error){
            connection.query("SELECT * FROM cliente WHERE id = '"+msg.from+"'",async function (err, cliente) {

              // PRIMEIRA TENTATIVA
              if(cliente[0].tentativas === "0"){
                connection.query("UPDATE cliente SET tentativas = 1 WHERE id = '"+msg.from+"'");
                connection.query("SELECT * FROM respostas WHERE nome = 'INFORMA-CPF-INVALIDO-1'",async function (err, resposta) {
                    wbot.sendMessage(msg.from,resposta[0].msg);
                })
              }
              // SEGUNDA TENTATIVA
              else if(cliente[0].tentativas === "1"){
                connection.query("UPDATE cliente SET tentativas = 2 WHERE id = '"+msg.from+"'");
                connection.query("SELECT * FROM respostas WHERE nome = 'INFORMA-CPF-INVALIDO-2'",async function (err, resposta) {
                    wbot.sendMessage(msg.from,resposta[0].msg);
                })
              }
              // TERCEIRA TENTATIVA
              else if(cliente[0].tentativas === "2"){
                connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
                connection.query("SELECT * FROM respostas WHERE nome = 'INFORMA-CPF-INVALIDO-FIM'",async function (err, resposta) {
                    wbot.sendMessage(msg.from,resposta[0].msg);
                  })
              }

        })}})})

      }
      if (msg.from){
        const now = new Date();
          
        let diaSemana = now.getDay();
        var horaAtual = now.getHours(); 
        var minutoAtual = ("0" + (now.getMinutes() + 1)).substr(-2);
        var HoraAtual = horaAtual.toString() + minutoAtual.toString() 
        var HoraInicioSemana = '900'; // DEFINE O HORARIO DE ATENDIMENTO 
        var HoraInicioSabado = '900'; // DEFINE O HORARIO DE ATENDIMENTO 
        var HoraFimSemana = '1800';  // DEFINE O HORARIO DE ATENDIMENTO
        var HoraFimSabado = '1800';  // DEFINE O HORARIO DE ATENDIMENTO

        connection.query("SELECT * FROM cliente WHERE id = '"+msg.from+"'",async function (err, cliente) {
                // CADASTRANDO NO BD wppbot
            if(cliente[0] === undefined){
                connection.query("SELECT * FROM respostas WHERE nome = 'INICIO'",async function (err, resposta) {
                    console.log("NAO CADASTRADO");
                    connection.query("INSERT INTO cliente (id) VALUES('"+msg.from+"')");
                    connection.query("SELECT * FROM respostas WHERE nome = 'INICIO'",async function (err, resposta) {
                        const fileUrl = resposta[0].img;
                        const media = await MessageMedia.fromUrl(fileUrl);
                        await wbot.sendMessage(msg.from, media, {caption: "Olá, *" + msg._data.notifyName + "*\n" + resposta[0].msg});
                    });
                });}


// ######################## CHECANDO HORARIO DE ATENDIMENTO COMERCIAL ######################
else if(cliente[0].categoria === '3' && msg.body === "3"){
    if(diaSemana === 0){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(diaSemana === 6 && HoraAtual < HoraInicioSabado && HoraAtual >= HoraFimSabado){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(HoraAtual < HoraInicioSemana && HoraAtual >= HoraFimSemana){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else{
        var num = msg.from.replace(/\D/g, '');
        connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
            connection.query("SELECT * FROM respostas WHERE nome = 'TRANSFERINDO'",async function (err, resposta) {
                var contatoId = numero[0].id;
                connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {
                    connection.query("UPDATE cliente SET categoria = '0' WHERE id = '"+msg.from+"'");
                    connection.query("UPDATE Tickets SET queueId = '1', status = 'pending' WHERE id = '"+ticket[0].id+"'");                        
                    wbot.sendMessage(msg.from,"*_- Comercial -_*\n\n" + resposta[0].msg);
                    console.log("DENTRO ATÉ O ZÔVO");
                });
            });
        });
    }                        
}
// ##########################################################################################################################

// ######################## CHECANDO HORARIO DE ATENDIMENTO FINANCEIRO ######################
else if(cliente[0].categoria === '3' && msg.body === "4"){
    if(diaSemana === 0){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(diaSemana === 6 && HoraAtual < HoraInicioSabado && HoraAtual >= HoraFimSabado){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(HoraAtual < HoraInicioSemana && HoraAtual >= HoraFimSemana){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else{
        var num = msg.from.replace(/\D/g, '');
        connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
            connection.query("SELECT * FROM respostas WHERE nome = 'TRANSFERINDO'",async function (err, resposta) {
                var contatoId = numero[0].id;
                connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {
                    connection.query("UPDATE cliente SET categoria = '0' WHERE id = '"+msg.from+"'");
                    connection.query("UPDATE Tickets SET queueId = '2', status = 'pending' WHERE id = '"+ticket[0].id+"'");                        
                    wbot.sendMessage(msg.from,"*_- Financeiro -_*\n\n" + resposta[0].msg);
                    console.log("DENTRO ATÉ O ZÔVO");
                });
            });
        });
    }                        
}
// ##########################################################################################################################

// ######################## CHECANDO HORARIO DE ATENDIMENTO SUPORTE ######################
else if(cliente[0].categoria === '3' && msg.body === "5"){
    if(diaSemana === 0){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(diaSemana === 6 && HoraAtual < HoraInicioSabado && HoraAtual >= HoraFimSabado){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(HoraAtual < HoraInicioSemana && HoraAtual >= HoraFimSemana){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else{
        var num = msg.from.replace(/\D/g, '');
        connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
            connection.query("SELECT * FROM respostas WHERE nome = 'TRANSFERINDO'",async function (err, resposta) {
                var contatoId = numero[0].id;
                connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {
                    connection.query("UPDATE cliente SET categoria = '0' WHERE id = '"+msg.from+"'");
                    connection.query("UPDATE Tickets SET queueId = '3', status = 'pending' WHERE id = '"+ticket[0].id+"'");                        
                    wbot.sendMessage(msg.from,"*_- Suporte -_*\n\n" + resposta[0].msg);
                    console.log("DENTRO ATÉ O ZÔVO");
                });
            });
        });
    }                        
}
// ##########################################################################################################################

// ######################## CHECANDO HORARIO DE ATENDIMENTO COMERCIAL ######################
else if(cliente[0].categoria === '4' && msg.body === "3"){
    if(diaSemana === 0){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(diaSemana === 6 && HoraAtual < HoraInicioSabado && HoraAtual >= HoraFimSabado){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(HoraAtual < HoraInicioSemana && HoraAtual >= HoraFimSemana){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else{
        var num = msg.from.replace(/\D/g, '');
        connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
            connection.query("SELECT * FROM respostas WHERE nome = 'TRANSFERINDO'",async function (err, resposta) {
                var contatoId = numero[0].id;
                connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {
                    connection.query("UPDATE cliente SET categoria = '0' WHERE id = '"+msg.from+"'");
                    connection.query("UPDATE Tickets SET queueId = '1', status = 'pending' WHERE id = '"+ticket[0].id+"'");                        
                    wbot.sendMessage(msg.from,"*_- Comercial -_*\n\n" + resposta[0].msg);
                    console.log("DENTRO ATÉ O ZÔVO");
                });
            });
        });
    }                        
}
// ##########################################################################################################################

// ######################## CHECANDO HORARIO DE ATENDIMENTO FINANCEIRO ######################
else if(cliente[0].categoria === '4' && msg.body === "4"){
    if(diaSemana === 0){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(diaSemana === 6 && HoraAtual < HoraInicioSabado && HoraAtual >= HoraFimSabado){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(HoraAtual < HoraInicioSemana && HoraAtual >= HoraFimSemana){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else{
        var num = msg.from.replace(/\D/g, '');
        connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
            connection.query("SELECT * FROM respostas WHERE nome = 'TRANSFERINDO'",async function (err, resposta) {
                var contatoId = numero[0].id;
                connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {
                    connection.query("UPDATE cliente SET categoria = '0' WHERE id = '"+msg.from+"'");
                    connection.query("UPDATE Tickets SET queueId = '2', status = 'pending' WHERE id = '"+ticket[0].id+"'");                        
                    wbot.sendMessage(msg.from,"*_- Finaceiro -_*\n\n" + resposta[0].msg);
                    console.log("DENTRO ATÉ O ZÔVO");
                });
            });
        });
    }                        
}
// ##########################################################################################################################

// ######################## CHECANDO HORARIO DE ATENDIMENTO SUPORTE ######################
else if(cliente[0].categoria === '4' && msg.body === "5"){
    if(diaSemana === 0){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(diaSemana === 6 && HoraAtual < HoraInicioSabado && HoraAtual >= HoraFimSabado){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(HoraAtual < HoraInicioSemana && HoraAtual >= HoraFimSemana){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else{
        var num = msg.from.replace(/\D/g, '');
        connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
            connection.query("SELECT * FROM respostas WHERE nome = 'TRANSFERINDO'",async function (err, resposta) {
                var contatoId = numero[0].id;
                connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {
                    connection.query("UPDATE cliente SET categoria = '0' WHERE id = '"+msg.from+"'");
                    connection.query("UPDATE Tickets SET queueId = '3', status = 'pending' WHERE id = '"+ticket[0].id+"'");                        
                    await sleep(2000)
                    wbot.sendMessage(msg.from,"*_- Suporte -_*\n\n" + resposta[0].msg);
                    console.log("DENTRO ATÉ O ZÔVO");
                });
            });
        });
    }                        
}
// ##########################################################################################################################

// ################################ DESBLOQUEIO CONFIANÇA ######################################
                else if(cliente[0].categoria === '4' && msg.body === "2"){
                    PromPag(url,token,cliente[0].cpfcnpj);

                }
/// ############################### 2VIA DE FATURA ##############################################
else if(cliente[0].categoria === '3' && msg.body === "1"){
    if(cliente[0].ultimaFat === 'undefined'){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-FATURA'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
        })
    }
    else{
        connection.query("SELECT * FROM respostas WHERE nome = 'COM-FATURA'",async function (err, resposta) {
            connection.query("SELECT * FROM respostas WHERE nome = 'FINALIZAR'",async function (err, respostas) {
                connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
                var $msg = 'Cliente: *'+cliente[0].nome+'*\nContrato: *'+cliente[0].contratoId+'*\nStatus: *'+cliente[0].contratoStatusDisplay+'*\n\n*INFORMAÇÕES PARA PAGAMENTO*\n\n📅 Vencimento: *'+cliente[0].ultimaFat_venc+'*\n\n💰 Valor: R$ *'+cliente[0].ultimaFat_valor+'*\n\n📲 Link de Pag:*'+cliente[0].ultimaFat+'*\n\n💠 Pix Qrcod:\n*'+cliente[0].pix_brcode+'\n\nA equipe *SJNET* agradece pelo seu contato!
Sempre que precisar é só me chamar. Tchau tchau!🤝';
            wbot.sendMessage(msg.from,$msg);

        })})                        
    }
}

else if(cliente[0].categoria === '4' && msg.body === "1"){
    if(cliente[0].ultimaFat){
        connection.query("SELECT * FROM respostas WHERE nome = 'COM-FATURA'",async function (err, resposta) {
            connection.query("SELECT * FROM respostas WHERE nome = 'FINALIZAR'",async function (err, respostas) {
                connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
                var $msg = 'Cliente: *'+cliente[0].nome+'*\nContrato: *'+cliente[0].contratoId+'*\nStatus: *'+cliente[0].contratoStatusDisplay+'*\n\n*INFORMAÇÕES PARA PAGAMENTO*\n\n📅 Vencimento: *'+cliente[0].ultimaFat_venc+'*\n\n💰 Valor: R$ *'+cliente[0].ultimaFat_valor+'*\n\n📲 Link de Pag:*'+cliente[0].ultimaFat+'*\n\n💠 Pix Qrcod:\n*'+cliente[0].pix_brcode+'\n\nA equipe *SJNET* agradece pelo seu contato!
Sempre que precisar é só me chamar. Tchau tchau!🤝';
            wbot.sendMessage(msg.from,$msg);
        })})                        
    }
    else{
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-FATURA'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
        })
    }
}

// ################################################################################################################

                







// ################################## E FINALIZAR ATENDIMENTO OP 0 ###############################
                else if(cliente[0].categoria === '3' && msg.body === "0"){
                    connection.query("SELECT * FROM respostas WHERE nome = 'FINALIZAR'",async function (err, resposta) {
                        connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
                        wbot.sendMessage(msg.from,resposta[0].msg);
                    })
            }
// ################################## SSEM RESPOSTA ###############################
                else if(cliente[0].categoria === '3'){
                    connection.query("SELECT * FROM cliente WHERE id = '"+msg.from+"'",async function (err, cliente) {
                        wbot.sendMessage(msg.from,"Cliente: *" + cliente[0].nome + "*\nContrato: *" + cliente[0].contratoId + "*\nStatus: *" + cliente[0].contratoStatusDisplay + "*\n\nPor Favor, escolha uma das *opções* abaixo:\n1️⃣ *2 Via Fatura*\n\nEscolha uma das *opções* abaixo para falar com um de nossos *Atendentes*:\n3️⃣ *Falar com Comercial*\n4️⃣ *Falar com Financeiro*\n5️⃣ *Falar com Suporte*\n\n_*Acesse Central:*_\n*https://sjnetfibra.rbfull.com.br/central/*\n_(basta informa seu *CPF*)_\n\n0️⃣ *Encerrar Atendimento*");
                    })
            }


// ################################## E FINALIZAR ATENDIMENTO OP 0 ###############################
                else if(cliente[0].categoria === '4' && msg.body === "0"){
                    connection.query("SELECT * FROM respostas WHERE nome = 'FINALIZAR'",async function (err, resposta) {
                        connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
                        wbot.sendMessage(msg.from,resposta[0].msg);
                    })
            }
// ################################## SSEM RESPOSTA ###############################
                else if(cliente[0].categoria === '4'){
                    connection.query("SELECT * FROM cliente WHERE id = '"+msg.from+"'",async function (err, cliente) {
                        wbot.sendMessage(msg.from,"Cliente: *" + cliente[0].nome + "*\nContrato: *" + cliente[0].contratoId + "*\nStatus: *" + cliente[0].contratoStatusDisplay + "*\n\nPor Favor, escolha uma das *opções* abaixo:\n1️⃣ *2 Via Fatura*\n\nEscolha uma das *opções* abaixo para falar com um de nossos *Atendentes*:\n3️⃣ *Falar com Comercial*\n4️⃣ *Falar com Financeiro*\n5️⃣ *Falar com Suporte*\n\n_*Acesse Central:*_\n*https://sjnetfibra.rbfull.com.br/central/*\n_(basta informa seu *CPF*)_\n\n0️⃣ *Encerrar Atendimento*");
                    })
            }

// ################################## E CLIENTE OP 1 ###############################
                else if(cliente[0].categoria === '1' && msg.body === "1"){
                    connection.query("SELECT * FROM respostas WHERE nome = 'INFORMA-CPF'",async function (err, resposta) {
                        connection.query("UPDATE cliente SET categoria = 2 WHERE id = '"+msg.from+"'");
                        wbot.sendMessage(msg.from,resposta[0].msg);
                    })
            }


// ################################## DIGITA CPF ###############################
            else if(cliente[0].categoria === '2'){
                SegundaVia(url,token,msg.body, msg.from);
        }

// ################################# NAO E CLIENTE OP 2 ###############################
// ######################## CHECANDO HORARIO DE ATENDIMENTO ######################
else if(cliente[0].categoria === '1' && msg.body === "2"){
    connection.query("SELECT * FROM QuickAnswers WHERE shortcut = 'PLANOS'",async function (err, resposta) {
        wbot.sendMessage(msg.from,resposta[0].message);
        connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
    })}
// ################################# FIM NAO E CLIENTE ###############################

// ################################# SOU TECNICO ###############################
// ######################## CHECANDO HORARIO DE ATENDIMENTO ######################
else if(cliente[0].categoria === '1' && msg.body === "3"){
    if(diaSemana === 0){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO-COM'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(diaSemana === 6 && HoraAtual < HoraInicioSabado && HoraAtual >= HoraFimSabado){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO-COM'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else if(HoraAtual < HoraInicioSemana && HoraAtual >= HoraFimSemana){
        connection.query("SELECT * FROM respostas WHERE nome = 'SEM-ATENDIMENTO-COM'",async function (err, resposta) {
            wbot.sendMessage(msg.from,resposta[0].msg);
            connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
        })}

    else{
        connection.query("UPDATE cliente SET categoria = '9' WHERE id = '"+msg.from+"'");
        wbot.sendMessage(msg.from,"⚠️ _*AUTENTICAÇÃO*_ ⚠️\n\n_Por favor,_\nDigite sua *Senha* para continar");
    }                        
}
else if(cliente[0].categoria === '9'){
    if(msg.body === senha){
        var num = msg.from.replace(/\D/g, '');
        connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
            connection.query("SELECT * FROM respostas WHERE nome = 'TRANSFERINDO'",async function (err, resposta) {
                var contatoId = numero[0].id;
                connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {
                    connection.query("UPDATE cliente SET categoria = '0' WHERE id = '"+msg.from+"'");
                    connection.query("UPDATE Tickets SET queueId = '3', status = 'pending' WHERE id = '"+ticket[0].id+"'");                        
                    wbot.sendMessage(msg.from,"*_- Suporte -_*\n\n" + resposta[0].msg);
                    console.log("DENTRO ATÉ O ZÔVO");
                });
            });
        });
    }
    else{
        wbot.sendMessage(msg.from,"❌ _*Senha Inválida*_ ❌\n\n_Atendimento finalizado..._\n_Até logo_ 😊");
        connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'")
    }

}
   
// ################################# FIM SOU TECNICO ###############################





                else if(cliente[0].categoria === '1'){
                    //MENSAGEM DE INICIO SEM IMAGEM
                    connection.query("SELECT * FROM respostas WHERE nome = 'INICIO-S-IMG'",async function (err, resposta) {
                        const fileUrl = resposta[0].img;
                        await wbot.sendMessage(msg.from,resposta[0].msg);
//                        SegundaVia(url,token,msg.body)
                    });
                }
                else if(cliente[0].categoria === '0'){
                    var num = msg.from.replace(/\D/g, '');
                    connection.query("SELECT * FROM Contacts WHERE number = '"+num+"'",async function (err, numero) {
                        var contatoId = numero[0].id;
                        connection.query("SELECT * from Tickets WHERE contactId = '"+contatoId+"' ORDER BY id DESC LIMIT 1",async function (err, ticket) {

                            if(ticket[0].status === 'closed'){
                                connection.query("DELETE FROM cliente WHERE id = '"+msg.from+"'");
                                connection.query("SELECT * FROM respostas WHERE nome = 'INICIO'",async function (err, resposta) {
                                    console.log("NAO CADASTRADO");
                                    connection.query("INSERT INTO cliente (id) VALUES('"+msg.from+"')");
                                    connection.query("SELECT * FROM respostas WHERE nome = 'INICIO'",async function (err, resposta) {
                                        const fileUrl = resposta[0].img;
                                        const media = await MessageMedia.fromUrl(fileUrl);
                                        await wbot.sendMessage(msg.from, media, {caption: "Olá, *" + msg._data.notifyName + "*\n" + resposta[0].msg});
                                    });
                                });
                            }

                        });});

                }
            });
        }
        else {
            
        }
    });
// ENVIO DE MENSAGEM DE MULTIMIDIA
//                            const fileUrl = "https://dctsistemas.com/TURBONETPNG.png";
//                            const media = await MessageMedia.fromUrl(fileUrl);
//                            await wbot.sendMessage(msg.from, media, {caption: ""});

// ENVIO DE MENSAGEM DE TEXTO
//                            wbot.sendMessage(msg.from, msg.type + "\n" + msg.to + "\n" + msg.body);

// ENVIO DE MENSAGEM DE RESPOSTA
//                            msg.reply(msg.type + "\n" + msg.to + "\n" + msg.body);
//                            console.log(msg);




































                io.emit("whatsappSession", {
                    action: "update",
                    session: whatsapp
                });
                const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
                if (sessionIndex === -1) {
                    wbot.id = whatsapp.id;
                    sessions.push(wbot);
                }
                wbot.sendPresenceAvailable();
                yield syncUnreadMessages(wbot);
                resolve(wbot);
            }));
        }
        catch (err) {
            logger_1.logger.error(err);
        }
    });
});
exports.getWbot = (whatsappId) => {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex === -1) {
        throw new AppError_1.default("ERR_WAPP_NOT_INITIALIZED");
    }
    return sessions[sessionIndex];
};
exports.removeWbot = (whatsappId) => {
    try {
        const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
        if (sessionIndex !== -1) {
            sessions[sessionIndex].destroy();
            sessions.splice(sessionIndex, 1);
        }
    }
    catch (err) {
        logger_1.logger.error(err);
    }
};
