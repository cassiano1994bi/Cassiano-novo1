import React, { useState } from "react";

function PainelCassiano() {
  const [saldo, setSaldo] = useState(0);
  const [metaMilhao] = useState(1000000);
  const [tarefa, setTarefa] = useState("");
  const [tarefas, setTarefas] = useState([]);
  const [nota, setNota] = useState("");
  const [notas, setNotas] = useState([]);
  const [obras, setObras] = useState([]);
  const [novaObra, setNovaObra] = useState("");

  const adicionarTarefa = () => {
    if (tarefa.trim()) {
      setTarefas([...tarefas, tarefa]);
      setTarefa("");
    }
  };

  const adicionarNota = () => {
    if (nota.trim()) {
      setNotas([...notas, nota]);
      setNota("");
    }
  };

  const adicionarObra = () => {
    if (novaObra.trim()) {
      setObras([...obras, novaObra]);
      setNovaObra("");
    }
  };

  const zerarTudo = () => {
    setTarefas([]);
    setNotas([]);
    setObras([]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>💰 Gestão Financeira</h2>
        <p>Saldo atual: R$ {saldo.toLocaleString("pt-BR")}</p>
        <p>Meta: R$ {metaMilhao.toLocaleString("pt-BR")}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>📋 Tarefas do Dia</h2>
        <input value={tarefa} onChange={(e) => setTarefa(e.target.value)} placeholder="Digite nova tarefa" />
        <button onClick={adicionarTarefa}>Adicionar</button>
        <ul>
          {tarefas.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>📝 Anotações Pessoais</h2>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escreva sua anotação aqui" />
        <button onClick={adicionarNota}>Salvar</button>
        <ul>
          {notas.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>🏗️ Relatórios de Obras</h2>
        <input value={novaObra} onChange={(e) => setNovaObra(e.target.value)} placeholder="Nome da obra" />
        <button onClick={adicionarObra}>Cadastrar</button>
        <ul>
          {obras.map((obra, i) => <li key={i}>{obra}</li>)}
        </ul>
      </div>

      <button onClick={zerarTudo} style={{ backgroundColor: 'red', color: 'white', padding: '10px', border: 'none' }}>
        Zerar Tudo
      </button>
    </div>
  );
}

export default PainelCassiano;
