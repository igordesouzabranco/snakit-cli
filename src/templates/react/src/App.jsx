// Componente raiz do projeto {{nome}}.
const estilo = { fontFamily: 'system-ui', padding: '2rem' };

export default function App() {
  return (
    <main style={estilo}>
      <h1>{{nome}}</h1>
      <p>Projeto criado com snakit.</p>
    </main>
  );
}
