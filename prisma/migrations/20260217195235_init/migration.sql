-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MECANICO', 'RESPONSAVEL', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusFerramenta" AS ENUM ('DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "papel" "Role" NOT NULL DEFAULT 'MECANICO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ferramentas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo_identificacao" TEXT NOT NULL,
    "status" "StatusFerramenta" NOT NULL DEFAULT 'DISPONIVEL',

    CONSTRAINT "ferramentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" TEXT NOT NULL,
    "data_retirada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_devolucao" TIMESTAMP(3),
    "observacao" TEXT,
    "ferramenta_id" TEXT NOT NULL,
    "mecanico_id" TEXT NOT NULL,
    "responsavel_liberacao_id" TEXT NOT NULL,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_sigla_key" ON "usuarios"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "ferramentas_codigo_identificacao_key" ON "ferramentas"("codigo_identificacao");

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_ferramenta_id_fkey" FOREIGN KEY ("ferramenta_id") REFERENCES "ferramentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_mecanico_id_fkey" FOREIGN KEY ("mecanico_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_responsavel_liberacao_id_fkey" FOREIGN KEY ("responsavel_liberacao_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
