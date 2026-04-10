import express, { type Request, type Response } from 'express';
import { PrismaClient } from "@prisma/client";
import cors from "cors";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Rota 1: Teste
app.get("/", (req: Request, res: Response) => {
  res.send("API Controle de Ferramentas Online <3");
});

// Rota 2: Listar Usuários (Movi para fora para não ficar aninhada)
app.get("/usuarios", async (req: Request, res: Response) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { nome: "asc" },
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar os colaboradores." });
  }
});

// Rota 3: Cadastrar Usuário
app.post("/usuarios", async (req: Request, res: Response) => {
  try {
    const { nome, sigla } = req.body;
    const novoUsuario = await prisma.usuario.create({
      data: { nome, sigla, papel: "MECANICO" },
    });
    res.status(201).json(novoUsuario);
  } catch (error) {
    res.status(400).json({ erro: "Erro ao criar usuário. A sigla já existe?" });
  }
});

// --- FERRAMENTAS ---

app.post("/ferramentas", async (req: Request, res: Response) => {
  try {
    const { nome, codigo_identificacao } = req.body;
    const novaFerramenta = await prisma.ferramenta.create({
      data: { nome, codigo_identificacao },
    });
    res.status(201).json(novaFerramenta);
  } catch (error) {
    res.status(400).json({ erro: "Erro ao cadastrar ferramenta." });
  }
});

app.get("/ferramentas", async (req: Request, res: Response) => {
  const todasFerramentas = await prisma.ferramenta.findMany({
    include: {
      movimentacoes: {
        where: { data_devolucao: null },
        include: { mecanico: true, responsavel_liberacao: true },
      },
    },
  });
  res.json(todasFerramentas);
});

// --- MOVIMENTAÇÕES ---

app.post("/emprestar", async (req: Request, res: Response): Promise<void> => {
  try {
    const { sigla_mecanico, sigla_responsavel, codigo_ferramenta } = req.body;

    const mecanico = await prisma.usuario.findUnique({ where: { sigla: sigla_mecanico } });
    const responsavel = await prisma.usuario.findUnique({ where: { sigla: sigla_responsavel } });
    const ferramenta = await prisma.ferramenta.findUnique({ where: { codigo_identificacao: codigo_ferramenta } });

    if (!mecanico || !responsavel || !ferramenta) {
      res.status(404).json({ erro: "Dados inválidos." });
      return;
    }

    if (ferramenta.status !== "DISPONIVEL") {
      res.status(400).json({ erro: "Ferramenta já em uso!" });
      return;
    }

    const movimentacao = await prisma.movimentacao.create({
      data: {
        mecanico_id: mecanico.id,
        responsavel_liberacao_id: responsavel.id,
        ferramenta_id: ferramenta.id,
      },
    });

    await prisma.ferramenta.update({
      where: { id: ferramenta.id },
      data: { status: "EM_USO" },
    });

    res.status(201).json({ mensagem: "Sucesso!", movimentacao });
  } catch (error) {
    res.status(500).json({ erro: "Erro interno." });
  }
});

app.post("/devolver", async (req: Request, res: Response): Promise<void> => {
  try {
    const { codigo_ferramenta, sigla_mecanico, sigla_supervisor } = req.body;

    const ferramenta = await prisma.ferramenta.findUnique({ where: { codigo_identificacao: codigo_ferramenta } });

    if (!ferramenta || ferramenta.status !== "EM_USO") {
      res.status(400).json({ erro: "Ferramenta não está em uso." });
      return;
    }

    const movimentacaoAberta = await prisma.movimentacao.findFirst({
      where: { ferramenta_id: ferramenta.id, data_devolucao: null },
    });

    const mecanicoDev = await prisma.usuario.findUnique({ where: { sigla: sigla_mecanico } });
    const supervisorDev = await prisma.usuario.findUnique({ where: { sigla: sigla_supervisor } });

    if (!mecanicoDev || !supervisorDev || !movimentacaoAberta) {
      res.status(404).json({ erro: "Dados de devolução inválidos." });
      return;
    }

    await prisma.movimentacao.update({
      where: { id: movimentacaoAberta.id },
      data: {
        data_devolucao: new Date(),
        mecanico_devolucao_id: mecanicoDev.id,
        responsavel_recebimento_id: supervisorDev.id,
      },
    });

    await prisma.ferramenta.update({
      where: { id: ferramenta.id },
      data: { status: "DISPONIVEL" },
    });

    res.status(200).json({ mensagem: "Devolvida com sucesso!" });
  } catch (error) {
    res.status(500).json({ erro: "Erro interno." });
  }
});

app.get("/historico", async (req: Request, res: Response) => {
  try {
    const historico = await prisma.movimentacao.findMany({
      where: { data_devolucao: { not: null } },
      orderBy: { data_devolucao: "desc" },
      include: {
        ferramenta: true,
        mecanico: true,
        responsavel_liberacao: true,
        mecanico_devolucao: true,
        responsavel_recebimento: true,
      },
    });
    res.json(historico);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar histórico." });
  }
});

// Ligando o servidor
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});