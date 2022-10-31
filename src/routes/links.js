const express = require('express');
const router = express.Router();
const path = require('path')

//anexar arquivo
const multer = require('multer');

//const DIR = './uploads';
const DIR = 'sftp://192.168.4.36/home/mgeweb/SankhyaW/Anexos';


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, DIR);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
        /* cd(null,new Date().toISOString() + file.originalname); */
    }
});

//propriedades da imagem
const upload = multer({
    storage: storage,
    limits: {
        fieldSize: 1024 * 1024 * 5
    }
});

const pool = require('../database');
const {
    isLoggedIn
} = require('../lib/auth');

router.get('/add', isLoggedIn, (req, res) => {});

//ADICIONAR NOVO USUARIO, SOMENTE ADMIN
router.get('/newuser', isLoggedIn, (req, res) => {
    res.render('links/newuser')
});

router.post('/newuser', isLoggedIn, (req, res) => {
    const nomeusu = req.body.nomeusu;
    const senha = req.body.senha;
    const fullname = req.body.fullname;

    pool.query(`INSERT INTO sankhya.AD_TBLOGIN (NOMEUSU, SENHA, fullname) VALUES('${nomeusu}','${senha}','${fullname}')`);

    res.redirect('/links/allogin')
});

//ADICIONAR CONTRATOS AOS NOVOS USUÁRIOS, SOMENTE ADMIN
router.get('/newcont', isLoggedIn, async (req, res) => {

    const links = await pool.query(`SELECT CODLOGIN,fullname,NOMEUSU,ADMINISTRADOR
    FROM sankhya.AD_TBLOGIN 
    ORDER BY NOMEUSU `);

    //LISTAR CONTRATOS ATIVOS/ BONIFICADOS CDASTRADOS NA BASE
    const links2 = await pool.query(`SELECT DISTINCT 
    CON.NUMCONTRATO, 
    PAR.NOMEPARC   
        FROM sankhya.TCSCON CON 
        INNER JOIN sankhya.TGFPAR PAR ON (PAR.CODPARC = CON.CODPARC) 
        INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
        INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
        INNER JOIN sankhya.TGFCTT C ON (PAR.CODPARC=C.CODPARC)   
        WHERE CON.ATIVO = 'S'  
        ORDER BY CON.NUMCONTRATO`);

    res.render('links/newcont', {
        lista: links.recordset,
        cont: links2.recordset
    })
});

router.post('/newcont', isLoggedIn, async (req, res) => {

    const contrato = req.body.numcontrat;
    const login = req.body.login;

    pool.query(`INSERT INTO sankhya.AD_TBACESSO (NUM_CONTRATO, ID_LOGIN) VALUES('${contrato}','${login}')`);

    req.flash('success', 'O Contrato foi Vincunlado com Sucesso!!!!')
    res.redirect('/links/newcont')
});

//ADD OS
//LISTA INFORMAÇÕES NA TELA DE ABERTURA DE OS
router.get('/orderserv', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN

    //contrato
    const links = await pool.query(`SELECT DISTINCT
        L.NUM_CONTRATO, L.ID_LOGIN AS LOGADO, SLA.CODCARGAHOR, PAR.NOMEPARC,
        CASE WHEN CON.AD_LOCALIDADE IS NOT NULL  THEN UPPER (CON.AD_LOCALIDADE)
        ELSE UPPER (PAR.NOMEPARC) END AS AD_LOCALIDADE,
        --CON.AD_LOCALIDADE,
        CON.AD_TSOLUCAO,
        CASE WHEN (CON.CODPARCSEC IS NULL OR CON.CODPARCSEC = 0) THEN PAR.CODPARC
        ELSE CON.CODPARCSEC END AS CODPARC,
        CON.CODUSUOS , L.ID_LOGIN,
        CON.AD_CIRCUITO,
        CD.NOMECID AS CIDADE,
        (CONVERT(VARCHAR(45),EN.NOMEEND,103)) as LOGRADOURO,
        CASE
                WHEN CON.AD_CODOCOROS IS NULL THEN 900
                ELSE CON.AD_CODOCOROS
            END AS CARTEIRA,
        UF1.CODUF AS UFCONT
    FROM sankhya.AD_TBACESSO L
        INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
        INNER JOIN sankhya.TGFPAR PAR ON (PAR.CODPARC = CON.CODPARC)
        INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
        INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
        INNER JOIN sankhya.TGFCTT C ON (PAR.CODPARC=C.CODPARC)
        LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
        LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
        LEFT JOIN sankhya.TSIBAI BR ON (PAR.CODBAI=BR.CODBAI)
        LEFT JOIN sankhya.TSICID CD ON (CD.CODCID=PAR.CODCID)
        LEFT JOIN sankhya.TSIEND EN ON (EN.CODEND=PAR.CODEND)
        LEFT JOIN sankhya.TSIUFS UF ON (UF.UF=CD.UF)
        LEFT JOIN sankhya.TFPLGR LG ON (LG.CODLOGRADOURO=EN.CODLOGRADOURO)
        FULL OUTER JOIN sankhya.TSICID CD1 ON (CON.CODCID = CD1.CODCID)
        FULL OUTER JOIN sankhya.TSIUFS UF1 ON (CD.UF = UF1.CODUF)
    WHERE L.ID_LOGIN =${idlogin}
        AND CON.ATIVO = 'S'
        AND PS.SITPROD IN ('A','B')
        AND PD.USOPROD IN ('S', 'R')
        AND (PD.USOPROD ='S' AND PS.SITPROD <>'S')
        AND TC.PRIORIDADE IS NULL
        GROUP BY CON.AD_LOCALIDADE, L.NUM_CONTRATO,PAR.NOMEPARC,PAR.CODPARC,  CON.CODUSUOS , L.ID_LOGIN,CON.AD_TSOLUCAO,   
        CON.AD_CIRCUITO,    CD.NOMECID, CON.AD_CODOCOROS,EN.NOMEEND,SLA.CODCARGAHOR, CON.CODPARCSEC, UF1.CODUF
    ORDER BY AD_LOCALIDADE`);

    //contatos
    const links2 = await pool.query(`SELECT DISTINCT
    CASE WHEN 
        (CON.CODPARCSEC IS NULL OR CON.CODPARCSEC = 0) 
        THEN UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+CONVERT(VARCHAR(30),c.CODCONTATO,103)
        ELSE UPPER  (CONVERT(VARCHAR(30),c2.NOMECONTATO,103))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+CONVERT(VARCHAR(30),c2.CODCONTATO,103)
    END AS CONTATO,
    CASE WHEN 
        (CON.CODPARCSEC IS NULL OR CON.CODPARCSEC = 0) 
        THEN c.CODCONTATO ELSE c2.CODCONTATO END AS CODCONT,
    CASE WHEN 
        (CON.CODPARCSEC IS NULL OR CON.CODPARCSEC = 0) 
        THEN  UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103))
        ELSE  UPPER  (CONVERT(VARCHAR(30),c2.NOMECONTATO,103))
    END AS NOME
    from sankhya.TGFPAR P
        INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
        INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
        LEFT JOIN sankhya.TGFPAR P2 ON (CON.CODPARCSEC=P2.CODPARC)
        INNER JOIN sankhya.TGFCTT C2 ON (P2.CODPARC=C2.CODPARC)
        inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    WHERE L.ID_LOGIN = ${idlogin}
        AND CON.ATIVO = 'S'
        AND C.ATIVO = 'S'
    order by CONTATO`);

    //serviços
    const links3 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(50),PD.DESCRPROD,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S')
    order by PRODUTO`);

    //produtos
    const links4 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(50),PD.DESCRPROD,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('R')
    order by PRODUTO`);

    res.render('links/testes', {
        geral: links.recordset,
        cont: links2.recordset,
        prod: links3.recordset,
        prod1: links4.recordset
    })
});

//ENVIA DADODS PARA BD (INSERT)
router.post('/orderserv', isLoggedIn, upload.single('file'), async (req, res) => {

    const links = await pool.query('select top (1) NUMOS +1 as NUMOS from sankhya.TCSOSE order by numos desc');
    const numos = Object.values(links.recordset[0])

    const idlogin = req.user.CODLOGIN
    const texto = req.body.texto;
    const filetoupload = upload
    /* const filetoupload = req.file.filename;
    const filetoupload2 = req.file.path; */
    const contrato = req.body.contrato;
    const parceiro = req.body.codparc;
    const produto = req.body.codprod;
    const servico = req.body.codserv;
    const contato = req.body.atualiza;
    const slccont = req.body.sla;
    const cart = req.body.carteira;
    const userlog = req.body.loginuser;

    const t1 = texto
    const textofin = t1.replace("'", "`");

    //verificação cód prioridade sla
    const links2 = await pool.query(`SELECT DISTINCT 
    CASE WHEN CON.AD_CIRCUITO IS NULL
        THEN 
            CASE  WHEN (DATEPART(DW,GETDATE() )) = 7   
         THEN
                CASE 
                WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --add apenas 360
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
               
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
            
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                ELSE
                        
                
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))		
                END 
    
        --SLA DOMINGO
        WHEN (DATEPART(DW,GETDATE() )) = 1
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
                 
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
               
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
            
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                ELSE
                        
                
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA TERÇA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 3
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA QUARTA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 4
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA QUINTA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 5
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA SEXTA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 6
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        ELSE
    
            --SLA SEGUNDA-FEIRA
            --NO MESMO DIA
            CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
                END END
            
        ELSE       
        CASE WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42430 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42432 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42433 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42434 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42435 
            THEN ((TC.VALORTEMPO/100)*60)
            
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42438 
            THEN ((TC.VALORTEMPO/100)*60)  
        END
    END
    
     AS VALORTEMPO 
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)  
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TFPCGH TH ON (TH.CODCARGAHOR=SLA.CODCARGAHOR)  
    LEFT JOIN sankhya.TFPHOR CH ON (TH.CODCARGAHOR=CH.CODCARGAHOR)     
    WHERE CON.NUMCONTRATO='${contrato}'
    AND CON.ATIVO = 'S'    
    AND PRIORIDADE =1`);
    const prioridade = Object.values(links2.recordset[0])

    await pool.query(`INSERT INTO sankhya.TCSOSE (NUMOS,NUMCONTRATO,DHCHAMADA,DTPREVISTA,CODPARC,CODCONTATO,CODATEND,CODUSURESP,DESCRICAO,SITUACAO,CODCOS,CODCENCUS,CODOAT,AD_LOGIN,POSSUISLA) VALUES 
    ('${numos}','${contrato}',GETDATE(),(SELECT DATEADD(MI,${prioridade},GETDATE())),'${parceiro}','${contato}',110,110,'${textofin}','P','',30101,1000000,'${userlog}','S');

    INSERT INTO SANKHYA.TCSITE (NUMOS,NUMITEM,CODSERV,CODPROD,CODUSU,CODOCOROS,CODUSUREM,DHENTRADA,DHPREVISTA,CODSIT,COBRAR,RETRABALHO,PRIORIDADE) VALUES 
    ('${numos}',1,40408,'${produto}',965,'${cart}',965,GETDATE(),(SELECT DATEADD(MI,${prioridade},GETDATE())),15,'N','N',1);
    
    UPDATE sankhya.AD_TBLOGIN SET ULTIMO_ACESSO = GETDATE() WHERE CODLOGIN =${idlogin}`);

    req.flash('success', 'Ordem De Serviço Criada com Sucesso!!!! Nº ', numos)
    res.redirect('/links')

});

//ADD OS (EXCLUSIVO ALGAR)
//LISTA INFORMAÇÕES NA TELA DE ABERTURA DE OS
router.get('/order-algar', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN

    //contrato
    const links = await pool.query(`SELECT DISTINCT L.NUM_CONTRATO, PAR.NOMEPARC,UPPER (CON.AD_LOCALIDADE),
    PAR.CODPARC,  CON.CODUSUOS , L.ID_LOGIN,
    CON.AD_CIRCUITO,
    CD.NOMECID AS CIDADE,
    (CONVERT(VARCHAR(45),EN.NOMEEND,103)) as LOGRADOURO,
    CASE
         WHEN CON.AD_CODOCOROS IS NULL THEN 900
         ELSE CON.AD_CODOCOROS
       END AS CARTEIRA
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TGFPAR PAR ON (PAR.CODPARC = CON.CODPARC) 
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    INNER JOIN sankhya.TGFCTT C ON (PAR.CODPARC=C.CODPARC)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TSIBAI BR ON (PAR.CODBAI=BR.CODBAI)
    LEFT JOIN sankhya.TSICID CD ON (CD.CODCID=PAR.CODCID)
    LEFT JOIN sankhya.TSIEND EN ON (EN.CODEND=PAR.CODEND)
    LEFT JOIN sankhya.TSIUFS UF ON (UF.UF=CD.UF)
    LEFT JOIN sankhya.TFPLGR LG ON (LG.CODLOGRADOURO=EN.CODLOGRADOURO)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S', 'R')
    AND (PD.USOPROD ='S' AND PS.SITPROD <>'S')
    AND TC.PRIORIDADE IS NULL
    ORDER BY CON.AD_CIRCUITO`);

    //contatos
    const links2 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),c.CODCONTATO,103) as CONTATO,
    c.CODCONTATO AS CODCONT,
    UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103)) as NOME
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND C.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S', 'R')
    order by CONTATO`);

    //serviços
    const links3 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(50),PD.DESCRPROD,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S')    
    order by PRODUTO`);

    //produtos
    const links4 = await pool.query(`SELECT DISTINCT 
     UPPER  (CONVERT(VARCHAR(50),PD.DESCRPROD,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('R')    
    order by PRODUTO`);

    res.render('links/testes', {
        geral: links.recordset,
        cont: links2.recordset,
        prod: links3.recordset,
        prod1: links4.recordset
    })
});

//ENVIA DADODS PARA BD (INSERT)
router.post('/order-algar', isLoggedIn, upload.single('file'), async (req, res) => {

    const links = await pool.query('select top (1) NUMOS +1 as NUMOS from sankhya.TCSOSE order by numos desc');
    const numos = Object.values(links.recordset[0])

    const idlogin = req.user.CODLOGIN
    const texto = req.body.texto;
    const filetoupload = upload
    /* const filetoupload = req.file.filename;
    const filetoupload2 = req.file.path; */
    const contrato = req.body.contrato;
    const parceiro = req.body.codparc;
    const produto = req.body.codprod;
    const servico = req.body.codserv;
    const contato = req.body.atualiza;
    const slccont = req.body.sla;
    const cart = req.body.carteira;
    const listacat = req.body.categoria;
    const userlog = req.body.loginuser;

    const t1 = texto
    const textofin = t1.replace("'", "`");

    //verificação cód prioridade sla
    const links2 = await pool.query(`SELECT DISTINCT 
    CASE WHEN CON.AD_CIRCUITO IS NULL
        THEN 
        CASE WHEN (PRIORIDADE=1 OR PRIORIDADE=2 )
        THEN ((TC.VALORTEMPO/100)*60)
        WHEN (PRIORIDADE BETWEEN 3 AND 5 )
        THEN
            CASE  
            WHEN (DATEPART(DW,GETDATE() )) = 7   
            THEN
                    CASE 
                    WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --add apenas 360
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
        
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
                
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))		
                    END 
    
            --SLA DOMINGO
            WHEN (DATEPART(DW,GETDATE() )) = 1
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                    DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
                    
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
                
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            --SLA TERÇA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 3
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            --SLA QUARTA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 4
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            --SLA QUINTA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 5
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            
            --SLA SEXTA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 6
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            ELSE    
            --SLA SEGUNDA-FEIRA            
            CASE 
            --NO MESMO DIA
            WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                --D+1
                WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
            
                --D+2
                WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                --D+3
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                ELSE  
            
                --D+4
                        DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
            
                        END END
                    
                ELSE       
                CASE WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42430 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42432 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42433 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42434 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42435 
                    THEN ((TC.VALORTEMPO/100)*60)
                    
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42438 
                    THEN ((TC.VALORTEMPO/100)*60)  
            END
        END  
    END AS VALORTEMPO  
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)  
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TFPCGH TH ON (TH.CODCARGAHOR=SLA.CODCARGAHOR)  
    LEFT JOIN sankhya.TFPHOR CH ON (TH.CODCARGAHOR=CH.CODCARGAHOR)     
    WHERE CON.NUMCONTRATO='${contrato}'
    AND CON.ATIVO = 'S'    
    AND PRIORIDADE ='${slccont}'`);
    const prioridade = Object.values(links2.recordset[0])

    await pool.query(`INSERT INTO sankhya.TCSOSE (NUMOS,NUMCONTRATO,DHCHAMADA,DTPREVISTA,CODPARC,CODCONTATO,CODATEND,CODUSURESP,DESCRICAO,SITUACAO,CODCOS,CODCENCUS,CODOAT,AD_LOGIN,POSSUISLA,AD_LISTACATEGORIA) VALUES 
    ('${numos}','${contrato}',GETDATE(),(SELECT DATEADD(MI,${prioridade},GETDATE())),'${parceiro}','${contato}',110,110,'${textofin}','P','',30101,1000000,'${userlog}','S','${listacat}');
    
    INSERT INTO SANKHYA.TCSITE (NUMOS,NUMITEM,CODSERV,CODPROD,CODUSU,CODOCOROS,CODUSUREM,DHENTRADA,DHPREVISTA,CODSIT,COBRAR,RETRABALHO,PRIORIDADE) VALUES 
    ('${numos}',1,40408,'${produto}',965,'${cart}',110,GETDATE(),(SELECT DATEADD(MI,${prioridade},GETDATE())),15,'N','N',${slccont});
    
    UPDATE sankhya.AD_TBLOGIN SET ULTIMO_ACESSO = GETDATE() WHERE CODLOGIN =${idlogin}`);

    req.flash('success', 'Ordem De Serviço Criada com Sucesso!!!! Nº ', numos)
    res.redirect('/links')

});

//ADD OS (EXCLUSIVO TJDF)
//LISTA INFORMAÇÕES NA TELA DE ABERTURA DE OS
router.get('/orderservs', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN

    //contrato
    const links = await pool.query(`SELECT DISTINCT L.NUM_CONTRATO, UPPER (PAR.NOMEPARC),UPPER (CON.AD_LOCALIDADE),
    PAR.CODPARC,  CON.CODUSUOS , L.ID_LOGIN,
    CON.AD_CIRCUITO,
    CD.NOMECID AS CIDADE,
    (CONVERT(VARCHAR(45),EN.NOMEEND,103)) as LOGRADOURO,
    CASE
         WHEN CON.AD_CODOCOROS IS NULL THEN 900
         ELSE CON.AD_CODOCOROS
       END AS CARTEIRA
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TGFPAR PAR ON (PAR.CODPARC = CON.CODPARC) 
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    INNER JOIN sankhya.TGFCTT C ON (PAR.CODPARC=C.CODPARC)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TSIBAI BR ON (PAR.CODBAI=BR.CODBAI)
    LEFT JOIN sankhya.TSICID CD ON (CD.CODCID=PAR.CODCID)
    LEFT JOIN sankhya.TSIEND EN ON (EN.CODEND=PAR.CODEND)
    LEFT JOIN sankhya.TSIUFS UF ON (UF.UF=CD.UF)
    LEFT JOIN sankhya.TFPLGR LG ON (LG.CODLOGRADOURO=EN.CODLOGRADOURO)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S', 'R')
    AND (PD.USOPROD ='S' AND PS.SITPROD <>'S')
    AND TC.PRIORIDADE IS NULL
    ORDER BY CON.AD_CIRCUITO`);

    //contatos
    const links2 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),c.CODCONTATO,103) as CONTATO,
    c.CODCONTATO AS CODCONT,
    UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103)) as NOME
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND C.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S', 'R')
    order by CONTATO`);

    //serviços
    const links3 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(50),CASE WHEN PS.CODPROD = 24707  THEN 'GATEWAY'
    ELSE 'TELEFONE' END,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S')
    AND PS.CODPROD NOT IN (25687,25691,3242)
    order by PRODUTO`);

    //produtos
    const links4 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(50),CASE WHEN PS.CODPROD = 24707  THEN 'GATEWAY'
    ELSE 'TELEFONE' END,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('R')
    AND PS.CODPROD NOT IN (25687,25691,3242)
    order by PRODUTO`);

    res.render('links/testes', {
        geral: links.recordset,
        cont: links2.recordset,
        prod: links3.recordset,
        prod1: links4.recordset
    })
});



//ENVIA INFORMAÇÕES BD (INSERT)
router.post('/orderservs', isLoggedIn, upload.single('file'), async (req, res) => {

    const links = await pool.query('select top (1) NUMOS +1 as NUMOS from sankhya.TCSOSE order by numos desc');
    const numos = Object.values(links.recordset[0])

    const idlogin = req.user.CODLOGIN
    const texto = req.body.texto;
    const filetoupload = upload
    /* const filetoupload = req.file.filename;
    const filetoupload2 = req.file.path; */
    const contrato = req.body.contrato;
    const parceiro = req.body.codparc;
    const produto = req.body.codprod;
    const servico = req.body.codserv;
    const contato = req.body.atualiza;
    const slccont = req.body.sla;
    const cart = req.body.carteira;
    const listacat = req.body.categoria;

    const t1 = texto
    const textofin = t1.replace("'", "`");

    //verificação cód prioridade sla
    const links2 = await pool.query(`SELECT DISTINCT 
    CASE WHEN CON.AD_CIRCUITO IS NULL
        THEN 
        CASE WHEN (PRIORIDADE=1 OR PRIORIDADE=2 )
        THEN ((TC.VALORTEMPO/100)*60)
        WHEN (PRIORIDADE BETWEEN 3 AND 5 )
        THEN
            CASE  
            WHEN (DATEPART(DW,GETDATE() )) = 7   
            THEN
                    CASE 
                    WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --add apenas 360
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
        
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
                
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))		
                    END 
    
            --SLA DOMINGO
            WHEN (DATEPART(DW,GETDATE() )) = 1
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                    DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
                    
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
                
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            --SLA TERÇA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 3
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            --SLA QUARTA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 4
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            --SLA QUINTA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 5
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            
            --SLA SEXTA-FEIRA
            WHEN (DATEPART(DW,GETDATE() )) = 6
            THEN
                    CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                    --D+1
                    WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
        
                    --D+2
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                    --D+3
                    WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    ELSE
                            
                    --D+4
                    DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                    END
        
            ELSE    
            --SLA SEGUNDA-FEIRA            
            CASE 
            --NO MESMO DIA
            WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                    --mesmo dia
                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
        
                --D+1
                WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
            
                --D+2
                WHEN 
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                        (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                                    THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
            
                --D+3
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                ELSE  
            
                --D+4
                        DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                    DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
            
                        END END
                    
                ELSE       
                CASE WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42430 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42432 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42433 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42434 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
                    THEN ((TC.VALORTEMPO/100)*60)
            
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42435 
                    THEN ((TC.VALORTEMPO/100)*60)
                    
                    WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42438 
                    THEN ((TC.VALORTEMPO/100)*60)  
            END
        END  
    END AS VALORTEMPO  
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)  
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TFPCGH TH ON (TH.CODCARGAHOR=SLA.CODCARGAHOR)  
    LEFT JOIN sankhya.TFPHOR CH ON (TH.CODCARGAHOR=CH.CODCARGAHOR)     
    WHERE CON.NUMCONTRATO='${contrato}'
    AND CON.ATIVO = 'S'    
    AND PRIORIDADE ='${slccont}'`);
    const prioridade = Object.values(links2.recordset[0])

    await pool.query(`INSERT INTO sankhya.TCSOSE (NUMOS,NUMCONTRATO,DHCHAMADA,DTPREVISTA,CODPARC,CODCONTATO,CODATEND,CODUSURESP,DESCRICAO,SITUACAO,CODCOS,CODCENCUS,CODOAT,POSSUISLA,AD_LISTACATEGORIA) VALUES 
    ('${numos}','${contrato}',GETDATE(),(SELECT DATEADD(MI,${prioridade},GETDATE())),'${parceiro}','${contato}',110,110,'${textofin}','P','',30101,1000000,'S','${listacat}');
    
    INSERT INTO SANKHYA.TCSITE (NUMOS,NUMITEM,CODSERV,CODPROD,CODUSU,CODOCOROS,CODUSUREM,DHENTRADA,DHPREVISTA,CODSIT,COBRAR,RETRABALHO,PRIORIDADE) VALUES 
    ('${numos}',1,40408,'${produto}',965,'${cart}',110,GETDATE(),(SELECT DATEADD(MI,${prioridade},GETDATE())),15,'N','N',${slccont});

    UPDATE sankhya.AD_TBLOGIN SET ULTIMO_ACESSO = GETDATE() WHERE CODLOGIN =${idlogin}`);

    req.flash('success', 'Ordem De Serviço Criada com Sucesso!!!! Nº ', numos)
    res.redirect('/links')

});

//PAGINAS DATATABLES
//LISTAR TODAS AS OS ABERTAS
router.get('/', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO,
    CASE WHEN L.NOMEUSU IS NULL THEN '-' ELSE L.NOMEUSU END AS USUARIO, 
    P.NOMEPARC, 
    C.AD_LOCALIDADE,   
    O.NUMOS, 
    OP.OPCAO,
    I.NUMITEM,
	I.PRIORIDADE,
    USU.NOMEUSU AS EXECUTANTE,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTPREVISTA,103)+' '+ CONVERT(VARCHAR(30),O.DTPREVISTA,108) AS PREVISAO,    
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    ITS.DESCRICAO

    FROM sankhya.TCSOSE O
    LEFT JOIN sankhya.TDDOPC OP ON (O.AD_LISTACATEGORIA = OP.VALOR)
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    LEFT JOIN sankhya.AD_TBLOGIN L ON (O.AD_LOGIN=L.CODLOGIN)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN SANKHYA.TSIUSU USU ON (USU.CODUSU = I.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND (OP.NUCAMPO = 9999991865 or OP.NUCAMPO is null)
    AND I.TERMEXEC IS NULL
    AND I.NUMITEM = (SELECT MAX(NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS AND TERMEXEC IS NULL)
    AND O.DHCHAMADA >= '01/01/2021'
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/list', {
        lista: links.recordset
    });
});

//LISTAR TODAS AS OS FECHADAS
router.get('/osclose', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    CASE WHEN L.NOMEUSU IS NULL THEN '-' ELSE L.NOMEUSU END AS USUARIO,
    P.NOMEPARC,
    CASE WHEN (C.AD_LOCALIDADE IS NULL AND P.NOMEPARC = 'ALGAR TELECOM') THEN P.NOMEPARC ELSE C.AD_LOCALIDADE END AS AD_LOCALIDADE,  
    --C.AD_LOCALIDADE,    
    O.NUMOS, 
    OP.OPCAO,
    I.NUMITEM,
	I.PRIORIDADE,
    CONVERT(VARCHAR(10), I.TERMEXEC, 120)  AS ABERTURA2,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
     CONVERT(VARCHAR(30),O.DTPREVISTA,103)+' '+ CONVERT(VARCHAR(30),O.DTPREVISTA,108) AS PREVISAO,
    CONVERT(VARCHAR(30),I.TERMEXEC,103)+' '+ CONVERT(VARCHAR(30),I.TERMEXEC,108) AS DT_EXECUCAO,  
    CASE WHEN I.TERMEXEC < O.DTPREVISTA THEN 'Dentro do SLA' WHEN I.TERMEXEC > O.DTPREVISTA THEN 'Fora do SLA' END  AS STS,
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO

    FROM sankhya.TCSOSE O
    LEFT JOIN sankhya.TDDOPC OP ON (O.AD_LISTACATEGORIA = OP.VALOR)
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    LEFT JOIN sankhya.AD_TBLOGIN L ON (O.AD_LOGIN=L.CODLOGIN)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND (OP.NUCAMPO = 9999991865 or OP.NUCAMPO is null)
    AND O.SITUACAO = 'F'
    AND I.TERMEXEC = (SELECT DISTINCT MAX (TERMEXEC) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    AND O.DHCHAMADA >= DATEADD(DAY, -60, GETDATE())
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/osclose', {
        lista: links.recordset
    });
});



router.get('/osclose2', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    CASE WHEN L.NOMEUSU IS NULL THEN '-' ELSE L.NOMEUSU END AS USUARIO,
    P.NOMEPARC,
    CASE WHEN (C.AD_LOCALIDADE IS NULL AND P.NOMEPARC = 'ALGAR TELECOM') THEN P.NOMEPARC ELSE C.AD_LOCALIDADE END AS AD_LOCALIDADE,  
    --C.AD_LOCALIDADE,    
    O.NUMOS, 
    OP.OPCAO,
    I.NUMITEM,
	I.PRIORIDADE,
    CONVERT(VARCHAR(10), O.DTFECHAMENTO, 120)  AS ABERTURA2,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
     CONVERT(VARCHAR(30),O.DTPREVISTA,103)+' '+ CONVERT(VARCHAR(30),O.DTPREVISTA,108) AS PREVISAO,
    CONVERT(VARCHAR(30),I.TERMEXEC,103)+' '+ CONVERT(VARCHAR(30),I.TERMEXEC,108) AS DT_EXECUCAO,  
    CASE WHEN I.TERMEXEC < O.DTPREVISTA THEN 'Dentro do SLA' WHEN I.TERMEXEC > O.DTPREVISTA THEN 'Fora do SLA' END  AS STS,
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO

    FROM sankhya.TCSOSE O
    LEFT JOIN sankhya.TDDOPC OP ON (O.AD_LISTACATEGORIA = OP.VALOR)
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    LEFT JOIN sankhya.AD_TBLOGIN L ON (O.AD_LOGIN=L.CODLOGIN)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND (OP.NUCAMPO = 9999991865 or OP.NUCAMPO is null)
    AND O.SITUACAO = 'F'
    AND I.TERMEXEC = (SELECT DISTINCT MAX (TERMEXEC) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    AND O.DHCHAMADA >= DATEADD(DAY, -60, GETDATE())
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/osclose2', {
        lista: links.recordset
    });
});




//listar todas as OS registradas para o parceiro
router.get('/all', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO,
    CASE WHEN L.NOMEUSU IS NULL THEN '-' ELSE L.NOMEUSU END AS USUARIO, 
    P.NOMEPARC,
    CASE WHEN (C.AD_LOCALIDADE IS NULL AND P.NOMEPARC = 'ALGAR TELECOM') THEN P.NOMEPARC ELSE C.AD_LOCALIDADE END AS AD_LOCALIDADE,    
    --C.AD_LOCALIDADE,  
    O.NUMOS,
    OP.OPCAO,    
    (CASE O.SITUACAO WHEN 'F' THEN 'Fechada'ELSE 'Aberta' END) AS SITUACAO, 
    I.NUMITEM,
	I.PRIORIDADE,
    CONVERT(VARCHAR(10), I.TERMEXEC, 120)  AS ABERTURA2,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
    CONVERT(VARCHAR(30),O.DTPREVISTA,103)+' '+ CONVERT(VARCHAR(30),O.DTPREVISTA,108) AS PREVISAO,
    CONVERT(VARCHAR(30),I.TERMEXEC,103)+' '+ CONVERT(VARCHAR(30),I.TERMEXEC,108) AS DT_EXECUCAO, 
    CASE WHEN I.TERMEXEC < O.DTPREVISTA THEN 'Dentro do SLA' WHEN I.TERMEXEC > O.DTPREVISTA THEN 'Fora do SLA' END  AS STS, 
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    
    (CASE  WHEN O.SITUACAO ='P' THEN  '' ELSE I.SOLUCAO END )  AS SOLUCAO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAOA,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    ITS.DESCRICAO

    FROM sankhya.TCSOSE O
    LEFT JOIN sankhya.TDDOPC OP ON (O.AD_LISTACATEGORIA = OP.VALOR)
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    LEFT JOIN sankhya.AD_TBLOGIN L ON (O.AD_LOGIN=L.CODLOGIN)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND (OP.NUCAMPO = 9999991865 or OP.NUCAMPO is null)
    AND O.SITUACAO in ('P','F')
    AND I.NUMITEM = (SELECT DISTINCT MAX (NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    AND O.DHCHAMADA >= DATEADD(DAY, -60, GETDATE())
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/all', {
        lista: links.recordset
    });
});

//listar todos os usuários (login) cadastrados
router.get('/allogin', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT CODLOGIN,fullname,NOMEUSU,ADMINISTRADOR
    FROM sankhya.AD_TBLOGIN`);
    res.render('links/allogin', {
        lista: links.recordset
    });
});

//CRUD 
//remover parceiro
router.get('/delete/:id', isLoggedIn, async (req, res) => {
    const {
        id
    } = req.params;
    await pool.query(`DELETE FROM sankhya.AD_TBPARCEIRO WHERE ID = ${id}`);
    req.flash('success', 'Link Removed Successfully');
    res.redirect('/links');
});

//editar parceiro - exibição tela
router.get('/edit/:id', isLoggedIn, async (req, res) => {
    const {
        id
    } = req.params;
    const links = await pool.query(`SELECT * FROM sankhya.AD_TBPARCEIRO WHERE ID = ${id}`);
    res.render('links/edit', {
        lista: links.recordset[0]
    })
});

//update
//ADICIONAR CONTRATOS AOS NOVOS USUÁRIOS, SOMENTE ADMIN
router.get('/password', isLoggedIn, async (req, res) => {

    res.render('links/passwords')
});

//update
//ATUALIZAR SENHA DO USUÁRIO
router.post('/password', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const contrato = req.body.contrato;
    pool.query(`UPDATE sankhya.AD_TBLOGIN
            SET SENHA = '${contrato}'
            WHERE CODLOGIN = '${idlogin}'`);

    req.flash('success', 'Senha atualizada com Sucesso!!!!')
    res.redirect('/signin')
});

module.exports = router;