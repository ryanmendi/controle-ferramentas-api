import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

const app = express();
const prisma = new PrismaClient();


app.use(cors());
// Permite que a nossa API entenda dados no formato JSON
app.use(express.json());

// Diz ao Express para servir arquivos estáticos (nossas telas de Front-end)
app.use(express.static('public'));

// Rota 1: Apenas para testar se a API está online
app.get('/', (req: Request, res: Response) => {
  res.send('Te Amo nikas <3');
});

// Rota 2: Cadastrando o primeiro Mecânico
app.post('/usuarios', async (req: Request, res: Response) => {
  try {
    const { nome, sigla } = req.body;

    // Aqui usamos o Prisma para salvar no banco de dados!
    const novoUsuario = await prisma.usuario.create({
      data: {
        nome: nome,
        sigla: sigla,
        papel: 'MECANICO' // Estamos fixando como mecânico por enquanto
      }
    });

    res.status(201).json(novoUsuario);
  } catch (error) {
    res.status(400).json({ erro: 'Erro ao criar usuário. A sigla já existe?' });
  }
});

// Ligando o servidor na porta 3333
app.listen(3333, () => {
  console.log('Servidor rodando no endereço: http://localhost:3333');
});

// ==========================================
// ROTAS DE FERRAMENTAS
// ==========================================

// Rota para CADASTRAR uma nova ferramenta
app.post('/ferramentas', async (req: Request, res: Response) => {
  try {
    const { nome, codigo_identificacao } = req.body;

    const novaFerramenta = await prisma.ferramenta.create({
      data: {
        nome: nome,
        codigo_identificacao: codigo_identificacao,
        // O status "DISPONIVEL" já entra automático por causa do nosso banco!
      }
    });

    res.status(201).json(novaFerramenta);
  } catch (error) {
    res.status(400).json({ erro: 'Erro ao cadastrar ferramenta. Esse código já existe?' });
  }
});

// Rota para LISTAR todas as ferramentas (TURBINADA para o Dashboard)
app.get('/ferramentas', async (req: Request, res: Response) => {
  const todasFerramentas = await prisma.ferramenta.findMany({
    include: {
      movimentacoes: {
        where: { data_devolucao: null }, 
        include: {
          mecanico: true,
          responsavel_liberacao: true // <-- AGORA O BACK-END TRAZ O SUPERVISOR!
        }
      }
    }
  });
  res.json(todasFerramentas);
});

// ==========================================
// ROTAS DE MOVIMENTAÇÃO (O CORAÇÃO DO SISTEMA)
// ==========================================

// Rota para EMPRESTAR (Retirar) uma ferramenta
app.post('/emprestar', async (req: Request, res: Response): Promise<any> => {
  try {
    // O tablet vai enviar apenas as siglas e o código, para ser rápido!
    const { sigla_mecanico, sigla_responsavel, codigo_ferramenta } = req.body;

    // 1. Buscar quem são essas pessoas e qual é a ferramenta no banco
    const mecanico = await prisma.usuario.findUnique({ where: { sigla: sigla_mecanico } });
    const responsavel = await prisma.usuario.findUnique({ where: { sigla: sigla_responsavel } });
    const ferramenta = await prisma.ferramenta.findUnique({ where: { codigo_identificacao: codigo_ferramenta } });

    // Se alguém digitou algo errado no tablet, o sistema barra aqui.
    if (!mecanico || !responsavel || !ferramenta) {
      return res.status(404).json({ erro: 'Dados inválidos. Verifique as siglas ou o código.' });
    }

    // 2. A SUPER REGRA DE NEGÓCIO: A ferramenta tá livre?
    if (ferramenta.status !== 'DISPONIVEL') {
      return res.status(400).json({ erro: 'Ação bloqueada: Esta ferramenta já está em uso ou em manutenção!' });
    }

    // 3. Salvar a movimentação E atualizar o status da ferramenta
    const movimentacao = await prisma.movimentacao.create({
      data: {
        mecanico_id: mecanico.id,
        responsavel_liberacao_id: responsavel.id,
        ferramenta_id: ferramenta.id
        // Nota: A "data_retirada" o banco já preenche sozinho com a hora atual!
      }
    });

    // Muda a ferramenta para "EM_USO" para ninguém mais conseguir pegar
    await prisma.ferramenta.update({
      where: { id: ferramenta.id },
      data: { status: 'EM_USO' }
    });

    // Responde para o tablet que deu tudo certo
    res.status(201).json({ 
      mensagem: 'Sucesso! Ferramenta liberada.', 
      movimentacao 
    });

  } catch (error) {
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});





// Rota para DEVOLVER uma ferramenta
app.post('/devolver', async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Recebe as siglas digitadas no Tablet
    const { codigo_ferramenta, sigla_mecanico, sigla_supervisor } = req.body;

    const ferramenta = await prisma.ferramenta.findUnique({
      where: { codigo_identificacao: codigo_ferramenta }
    });

    if (!ferramenta) {
      return res.status(404).json({ erro: 'Ferramenta não encontrada.' });
    }

    if (ferramenta.status !== 'EM_USO') {
      return res.status(400).json({ erro: 'Ação bloqueada: Esta ferramenta já está disponível no painel.' });
    }

    const movimentacaoAberta = await prisma.movimentacao.findFirst({
      where: { ferramenta_id: ferramenta.id, data_devolucao: null }
    });

    if (!movimentacaoAberta) {
      return res.status(400).json({ erro: 'Nenhuma ficha de empréstimo aberta para esta ferramenta.' });
    }

    // 2. Procura as pessoas que estão devolvendo no banco de dados
    const mecanicoDev = await prisma.usuario.findUnique({ where: { sigla: sigla_mecanico } });
    const supervisorDev = await prisma.usuario.findUnique({ where: { sigla: sigla_supervisor } });

    if (!mecanicoDev || !supervisorDev) {
      return res.status(404).json({ erro: 'Sigla de devolução inválida. Verifique se estão corretas.' });
    }

    // 3. ATUALIZA A FICHA COM AS NOVAS SIGLAS (AQUI ESTAVA O SEGREDO!)
    await prisma.movimentacao.update({
      where: { id: movimentacaoAberta.id },
      data: { 
        data_devolucao: new Date(),
        mecanico_devolucao_id: mecanicoDev.id,
        responsavel_recebimento_id: supervisorDev.id
      } 
    });

    // 4. Libera a ferramenta
    await prisma.ferramenta.update({
      where: { id: ferramenta.id },
      data: { status: 'DISPONIVEL' }
    });

    res.status(200).json({ mensagem: 'Ferramenta devolvida com sucesso! Histórico atualizado.' });

  } catch (error) {
    console.error("Erro na devolução:", error);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

// Rota para ver o HISTÓRICO
app.get('/historico', async (req: Request, res: Response) => {
  try {
    const historico = await prisma.movimentacao.findMany({
      where: { data_devolucao: { not: null } },
      orderBy: { data_devolucao: 'desc' },
      include: {
        ferramenta: true,
        mecanico: true,             
        responsavel_liberacao: true, 
        mecanico_devolucao: true,      
        responsavel_recebimento: true  
      }
    });
    
    res.json(historico);
  } catch (error) {
    console.log("ERRO NO HISTÓRICO:", error);
    res.status(500).json({ erro: 'Erro ao buscar histórico.' });
  }
});