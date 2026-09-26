import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  Banknote,
  Bomb,
  Car,
  Cigarette,
  FileWarning,
  FlaskConical,
  Gavel,
  Gem,
  PawPrint,
  Pill,
  ShieldAlert as ShieldAlertIcon,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { Reveal } from '../../components/Reveal';
import { useDocumentMeta, useJsonLd } from '../../lib/useDocumentMeta';
import { SUPPORT_HOURS, SUPPORT_WHATSAPP_LABEL, supportWhatsAppUrl } from '../../lib/support';
export function HowItWorks() {
  useDocumentMeta({
    title: 'Como funciona — venda por lances',
    description:
      'Entenda como funciona vender e comprar usados por lances no MeuLance: anuncie grátis, receba lances progressivos e feche pelo valor real de mercado.',
    canonicalPath: '/como-funciona',
  });
  useJsonLd('ld-faq', HOW_FAQ_LD);
  return (
    <main className="page">
      <div className="form-intro">
        <span className="kicker">COMO FUNCIONA</span>
        <h1>Seu preço não é um chute. É o que o mercado paga.</h1>
        <p>
          Anúncio de preço fixo trava seu item num número — alto demais e ninguém compra, baixo demais e você
          perde dinheiro. Na venda por lances do MeuLance, quem decide o preço são as pessoas que realmente
          querem seu item, disputando lance a lance até o valor justo.
        </p>
      </div>
      <Reveal>
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <div>
              <span className="kicker">PARA QUEM VENDE</span>
              <h2>Do anúncio ao dinheiro na conta, em 3 passos</h2>
            </div>
          </div>
          <div className="steps steps-light">
            <article>
              <b>01</b>
              <Gavel />
              <h3>Anuncie de graça</h3>
              <p>
                Fotos, descrição e um preço inicial baixo — anúncios com lance inicial atrativo atraem mais
                disputa e terminam em valores mais altos.
              </p>
            </article>
            <article>
              <b>02</b>
              <Sparkles />
              <h3>Acompanhe os lances subirem</h3>
              <p>Interessados disputam ao vivo, com contagem regressiva e histórico público de lances.</p>
            </article>
            <article>
              <b>03</b>
              <WalletCards />
              <h3>Combine entrega e receba</h3>
              <p>
                O maior lance vence, um pedido é criado automaticamente e você combina envio ou retirada pelo
                chat do pedido.
              </p>
            </article>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="section">
          <div className="section-head">
            <div>
              <span className="kicker">A DIFERENÇA NA PRÁTICA</span>
              <h2>Venda por lances vs. anúncio de preço fixo</h2>
            </div>
          </div>
          <div className="compare-grid">
            <div className="compare-card">
              <span className="compare-tag">Preço fixo</span>
              <ul>
                <li>Você define um número e espera — sem saber se é alto ou baixo demais.</li>
                <li>Compradores pechincham no particular, um de cada vez, sem pressão de tempo.</li>
                <li>Anúncios ficam parados por semanas sem gerar urgência.</li>
              </ul>
            </div>
            <div className="compare-card highlight">
              <span className="compare-tag">Venda por lances no MeuLance</span>
              <ul>
                <li>O preço sobe conforme o interesse real — quem mais quer, mais paga.</li>
                <li>
                  Prazo com contagem regressiva pública cria urgência genuína no fim do prazo de lances.
                </li>
                <li>Histórico de lances transparente aumenta a confiança de quem está comprando.</li>
              </ul>
            </div>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <div className="cta">
          <div>
            <span className="kicker">PRONTO PARA COMEÇAR?</span>
            <h2>Anuncie seu primeiro item agora mesmo.</h2>
            <p>Leva menos de 5 minutos e você não paga nada até vender.</p>
          </div>
          <Link className="btn light" to="/vender/novo">
            Quero vender <ArrowRight />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
const PROHIBITED_CATEGORIES = [
  {
    Icon: Bomb,
    title: 'Armas, munições e explosivos',
    text: 'Armas de fogo, peças essenciais, munição, insumos de recarga, explosivos, réplicas confundíveis com armas reais e itens controlados pelo Exército.',
  },
  {
    Icon: Pill,
    title: 'Drogas, medicamentos e produtos farmacêuticos',
    text: 'Com ou sem receita, substâncias controladas, cannabis e produtos com alegações terapêuticas. A regulamentação sanitária da Anvisa continua valendo.',
  },
  {
    Icon: Cigarette,
    title: 'Cigarros, tabaco e vape',
    text: 'Cigarros eletrônicos, tabaco e similares — bloqueados integralmente.',
  },
  {
    Icon: Ban,
    title: 'Produtos falsificados, pirateados ou roubados',
    text: 'Réplicas, itens com serial adulterado ou de origem criminosa. A legislação exige que plataformas previnam produtos ilícitos e violações de propriedade intelectual.',
  },
  {
    Icon: PawPrint,
    title: 'Animais vivos e fauna/flora protegida',
    text: 'Animais, espécies silvestres, partes de animais, produtos derivados de espécies ameaçadas e itens que exijam autorização ambiental.',
  },
  {
    Icon: ShieldAlertIcon,
    title: 'Produtos adultos/sexuais explícitos',
    text: 'Bloqueados nesta fase inicial da plataforma.',
  },
  {
    Icon: FileWarning,
    title: 'Dados pessoais, documentos e contas',
    text: 'RG, CPF, passaporte, CNH, contas bancárias, contas de redes sociais ou de jogos, cadastros, listas de clientes e qualquer banco de dados pessoal.',
  },
  {
    Icon: Banknote,
    title: 'Dinheiro, moeda, crédito e produtos financeiros',
    text: 'Dinheiro em espécie, Pix "com desconto", saldo de carteira, cartões, contas bancárias, empréstimos e títulos.',
  },
  {
    Icon: FlaskConical,
    title: 'Produtos químicos perigosos',
    text: 'Venenos, substâncias tóxicas controladas, precursores químicos, radioativos, agrotóxicos, pesticidas e raticidas.',
  },
  {
    Icon: Car,
    title: 'Veículos, imóveis e serviços',
    text: 'Fora do escopo do MeuLance, que é focado em bens físicos comuns na faixa de preço e logística já definidas.',
  },
  {
    Icon: Gem,
    title: 'Joias e metais preciosos de alto valor',
    text: 'Ouro, pedras preciosas e relógios caros — bloqueados nesta fase inicial pelo risco de falsificação, lavagem e roubo.',
  },
  {
    Icon: UtensilsCrossed,
    title: 'Alimentos, suplementos e cosméticos regulados',
    text: 'Exigem controle de validade, registro, procedência e armazenamento — bloqueados no lançamento.',
  },
  {
    Icon: Stethoscope,
    title: 'Equipamentos médicos e produtos de saúde regulados',
    text: 'Exigem regularização junto à Anvisa. Bloqueados até haver uma política específica.',
  },
  {
    Icon: Wrench,
    title: 'Itens de segurança usados de veículos',
    text: 'Airbags, freios, cintos de segurança, direção, suspensão e semelhantes.',
  },
  {
    Icon: FileWarning,
    title: 'Conteúdo ilícito ou que promova abuso/discriminação',
    text: 'Qualquer material ilegal, de apologia a crimes ou discriminação.',
  },
] as const;
export function ProhibitedItemsPage() {
  useDocumentMeta({
    title: 'Itens Proibidos',
    description: 'Categorias de itens que não podem ser anunciados no MeuLance.',
    canonicalPath: '/itens-proibidos',
  });
  return (
    <main className="page simple legal-page prohibited-page">
      <span className="kicker">MEULANCE</span>
      <h1>Itens proibidos</h1>
      <p>
        Estas categorias não podem ser anunciadas no MeuLance. Anúncios encontrados nessas categorias são
        removidos e a conta pode ser suspensa. Ver também os <Link to="/termos">Termos de Uso</Link>.
      </p>
      <div className="prohibited-grid">
        {PROHIBITED_CATEGORIES.map(({ Icon, title, text }) => (
          <article className="prohibited-card" key={title}>
            <Icon size={20} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="notice">
        <ShieldAlertIcon size={16} />
        Viu um anúncio de item proibido? Use o botão "Denunciar anúncio" na página do item.
      </div>
    </main>
  );
}
/** Links como /termos#no-estado: a página é carregada sob demanda, então rola depois de montar. */
function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);
}
export function TermsPage() {
  useScrollToHash();
  useDocumentMeta({
    title: 'Termos de Uso',
    description:
      'Termos de Uso do MeuLance: lances, verificação, prazos, entrega, estado do item, taxas e itens proibidos.',
    canonicalPath: '/termos',
  });
  return (
    <main className="page simple legal-page">
      <span className="kicker">MEULANCE</span>
      <h1>Termos de Uso</h1>
      <h2>1. O que é o MeuLance</h2>
      <p>
        O MeuLance é uma plataforma de compra e venda de itens usados entre pessoas físicas, por meio de
        lances. O vendedor anuncia voluntariamente o próprio produto, mantém a posse dele até a conclusão da
        venda e recebe lances de compradores através da infraestrutura tecnológica do MeuLance. Ao criar uma
        conta, você concorda com estes Termos.
      </p>
      <h2>2. Lances são compromisso de compra</h2>
      <p>
        Ao confirmar um lance, você assume o compromisso de pagar aquele valor caso ele seja o maior ao final
        do prazo de lances. Lances não podem ser cancelados após confirmados.
      </p>
      <h2>3. Verificação de identidade do vendedor</h2>
      <p>
        Para publicar anúncios, o vendedor precisa verificar a identidade com documento oficial e selfie. Isso
        reduz o risco de fraude e de venda de itens de origem ilícita, mas não elimina esse risco por completo
        — o MeuLance intermedia o encontro entre comprador e vendedor, não garante a procedência do item.
      </p>
      <h2>4. Prazo para reclamar de um pedido entregue</h2>
      <p>
        O comprador tem até <b>7 dias corridos a partir da entrega</b> para reportar um problema com o pedido
        (item não recebido, diferente do anunciado, com defeito não declarado) e solicitar reembolso, abrindo
        uma disputa pela plataforma. Passado esse prazo sem reclamação registrada, o pedido é considerado
        concluído, o reembolso deixa de ser garantido pela plataforma, e o MeuLance não se responsabiliza por
        reclamações feitas fora desse período. Para itens vendidos no estado, valem as regras da seção 10.
      </p>
      <h2>4.1 Devolução do item e frete de devolução</h2>
      <p>
        Quando o motivo da reclamação é responsabilidade do vendedor (item diferente do anunciado, com defeito
        não declarado ou não enviado), comprador e vendedor devem combinar a devolução — endereço,
        transportadora e prazo — diretamente pelo chat do pedido. Nesse caso, o custo do frete de devolução é
        do vendedor: ele deve reembolsar o valor do frete ao comprador ou fornecer um código de postagem pago.
        O reembolso do item só é confirmado pela plataforma depois que o vendedor confirma o recebimento da
        devolução. O MeuLance não contrata transportadora nem antecipa esse custo.
      </p>
      <h2>5. Entrega</h2>
      <p>
        Envio ou retirada são combinados diretamente entre comprador e vendedor pelo chat do pedido, conforme
        a modalidade escolhida no anúncio. O MeuLance não contrata nem gerencia a transportadora.
      </p>
      <p id="confirmar-recebimento">
        O comprador confirma o recebimento pelo botão “Confirmar recebimento”, em Meus pedidos ou na página do
        pedido, tanto no envio quanto na retirada em mãos. Só confirme depois de receber e conferir o item: a
        confirmação encerra o pedido e libera o valor ao vendedor. Não existe código de retirada, e o vendedor
        não deve pedir que o comprador confirme na frente dele.
      </p>
      <h2>6. Itens proibidos</h2>
      <p>
        É proibido anunciar, entre outras categorias: armas, munições e explosivos; drogas e medicamentos;
        cigarros, tabaco e vape; produtos falsificados, pirateados ou roubados; animais vivos e fauna/flora
        protegida; conteúdo adulto explícito; dados pessoais, documentos e contas; dinheiro e produtos
        financeiros; produtos químicos perigosos; veículos, imóveis e serviços; joias e metais preciosos de
        alto valor; alimentos, suplementos e cosméticos regulados; equipamentos médicos regulados; peças de
        segurança automotivas usadas; e qualquer conteúdo ilícito. Lista completa e detalhada em{' '}
        <Link to="/itens-proibidos">Itens proibidos</Link>. Anúncios nessas categorias são removidos e a conta
        pode ser suspensa.
      </p>
      <h2>7. Cancelamento de anúncio pelo vendedor</h2>
      <p>
        O vendedor pode cancelar um anúncio livremente enquanto não houver lances. Após o primeiro lance, o
        cancelamento só é permitido se faltar mais de 1 dia para o encerramento.
      </p>
      <h2 id="estado-do-item">8. Estado do item e checklist de funcionamento</h2>
      <p>
        O MeuLance vende itens de pessoas físicas, em geral usados. O vendedor escolhe um dos estados abaixo e
        responde a um checklist de funcionamento da categoria (por exemplo: liga, tela, bateria, bloqueio de
        conta). Cada resposta pode ser “Sim”, “Não”, “Não testei” ou “Não se aplica”.
      </p>
      <ul>
        <li>
          <b>Como novo:</b> funciona 100%, sem marcas visíveis.
        </li>
        <li>
          <b>Bom:</b> funciona 100%, com marcas leves de uso.
        </li>
        <li>
          <b>Regular:</b> funciona, com marcas fortes ou pequenos defeitos declarados.
        </li>
        <li>
          <b>No estado / para peças:</b> pode não funcionar; ver seção 10.
        </li>
      </ul>
      <p>
        O estado, o checklist, a descrição e os defeitos declarados formam a declaração do vendedor e ficam
        registrados de forma imutável no fim do prazo de lances. Em uma disputa, o que conta é a comparação
        entre o que foi declarado e o que o comprador recebeu:
      </p>
      <ul>
        <li>
          Item respondido como “Sim” que chega sem funcionar, ou defeito relevante não declarado, dá direito a
          reembolso nos termos da seção 4.
        </li>
        <li>
          Defeito declarado (na descrição, no checklist ou em foto de defeito) não é motivo de reclamação.
        </li>
        <li>
          “Não testei” significa que o vendedor não garante aquele ponto. O comprador assume esse risco ao dar
          lance, desde que o vendedor não tenha omitido um defeito que conhecia.
        </li>
      </ul>
      <p>
        O MeuLance não inspeciona os itens e não garante autenticidade, procedência ou funcionamento. A
        plataforma exige a declaração do vendedor e protege o pagamento conforme estes Termos.
      </p>
      <h2 id="fotos-de-defeito">9. Fotos de defeito</h2>
      <p>
        Se o vendedor marcar algum item do checklist como “Não”, descrever defeitos ou anunciar no estado, ele
        precisa enviar pelo menos uma foto que mostre o defeito. Essas fotos aparecem separadas no anúncio e
        fazem parte da declaração do vendedor. Esconder um defeito conhecido, ou mostrá-lo de forma enganosa,
        conta como item diferente do anunciado.
      </p>
      <h2 id="no-estado">10. Itens vendidos no estado (para peças ou conserto)</h2>
      <p>
        Itens anunciados como <b>No estado / para peças</b> são vendidos como estão: podem não ligar, não
        funcionar ou estar incompletos, e não têm garantia de funcionamento. Antes do primeiro lance nesse
        tipo de anúncio, o comprador precisa aceitar essas condições expressamente.
      </p>
      <p>Nesses itens, a disputa só é aceita quando:</p>
      <ul>
        <li>o item não foi enviado ou entregue;</li>
        <li>
          o item recebido é diferente do anunciado (outro modelo, peças trocadas ou faltando além do
          declarado); ou
        </li>
        <li>o vendedor declarou algo falso no checklist ou omitiu um defeito que conhecia.</li>
      </ul>
      <p>
        Dano ou mau funcionamento, por si só, não é motivo de disputa em item vendido no estado. Os demais
        prazos e regras da seção 4 continuam valendo.
      </p>
      <h2 id="taxas">11. Taxas</h2>
      <p>
        Anunciar é grátis. Quando o item é vendido, o vendedor paga uma comissão de 5% sobre o valor da venda,
        e o comprador paga uma <b>taxa de proteção de 3%</b> sobre o mesmo valor, somada ao total do pedido. A
        taxa de proteção cobre a intermediação do pagamento e o processo de disputa. Os percentuais vigentes
        aparecem antes do lance e no pedido. Pagar ou combinar pagamento fora da plataforma para evitar as
        taxas é proibido e retira a proteção do pedido.
      </p>
      <h2 id="segundo-colocado">12. Oferta ao 2º colocado</h2>
      <p>
        Ao criar o anúncio, o vendedor escolhe se aceita oferecer o item ao 2º colocado. Com essa opção
        ligada, se o vencedor não pagar no prazo, o pedido dele é cancelado e o participante com o 2º maior
        lance recebe uma oferta pelo valor do próprio maior lance, mais a taxa de proteção. Ele tem 24 horas
        para aceitar e não é obrigado a comprar: a oferta só vira pedido se ele aceitar. Existe no máximo uma
        oferta por anúncio. O vencedor que não paga recebe uma advertência na conta. Sem essa opção, ou se o
        2º colocado recusar ou não responder, o vendedor pode relançar o anúncio: começa uma nova disputa e os
        lances anteriores deixam de valer.
      </p>
      <h2 id="imei">13. IMEI de celulares</h2>
      <p>
        Em anúncios de celular, o vendedor informa o IMEI do aparelho, que é validado pela plataforma. O
        número não aparece no anúncio: fica visível só para o vendedor e, depois do pagamento, para o
        comprador, que pode consultar na Anatel se o aparelho tem restrição e conferir se o IMEI do celular
        recebido é o mesmo. IMEI diferente do informado conta como item diferente do anunciado. O IMEI é
        apagado automaticamente 20 dias após a conclusão do pedido.
      </p>
    </main>
  );
}

type Faq = { q: string; a: string };
const faqLd = (items: Faq[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});
const HOW_FAQ_LD = faqLd([
  {
    q: 'Quanto custa anunciar no MeuLance?',
    a: 'Anunciar é grátis. O MeuLance cobra uma pequena comissão apenas sobre vendas concluídas.',
  },
  {
    q: 'Por que vender por lances em vez de preço fixo?',
    a: 'Na venda por lances, vários compradores disputam o mesmo item ao mesmo tempo, o que tende a levar o preço final até o valor real de mercado — em vez de você chutar um preço fixo e torcer.',
  },
  {
    q: 'O que acontece quando o prazo de lances termina?',
    a: 'O maior lance vence, um pedido é criado automaticamente e comprador e vendedor combinam pagamento e entrega pelo chat do pedido.',
  },
]);

function DraftNotice() {
  return (
    <div className="notice">
      <ShieldCheck size={16} aria-hidden />
      Rascunho de trabalho — ainda não revisado por advogado. Não é um documento jurídico definitivo.
    </div>
  );
}

const INCREMENTS = [
  ['Até R$ 100', 'R$ 2'],
  ['De R$ 100,01 a R$ 500', 'R$ 5'],
  ['De R$ 500,01 a R$ 2.000', 'R$ 10'],
  ['Acima de R$ 2.000', 'R$ 25'],
] as const;

export function AuctionRulesPage() {
  useDocumentMeta({
    title: 'Regras da venda por lances',
    description:
      'Como funcionam os lances no MeuLance: lance mínimo, incrementos, lance automático, prorrogação anti-sniping e compromisso de compra.',
    canonicalPath: '/regras-de-lance',
  });
  return (
    <main className="page simple legal-page">
      <span className="kicker">MEULANCE</span>
      <h1>Regras da venda por lances</h1>
      <DraftNotice />
      <h2>1. Lance é compromisso de compra</h2>
      <p>
        Todo lance confirmado é vinculante: se você vencer, assume o compromisso de pagar o valor do lance.
        Depois do primeiro lance, o vendedor também fica vinculado e não pode alterar título, fotos, defeitos
        declarados ou preço inicial.
      </p>
      <h2>2. Lance mínimo e incrementos</h2>
      <p>
        Sem lances, o mínimo é o valor inicial definido pelo vendedor. Com lances, o mínimo é o preço atual
        mais o incremento da faixa:
      </p>
      <table className="rules-table">
        <thead>
          <tr>
            <th scope="col">Preço atual</th>
            <th scope="col">Incremento mínimo</th>
          </tr>
        </thead>
        <tbody>
          {INCREMENTS.map(([range, inc]) => (
            <tr key={range}>
              <td>{range}</td>
              <td>{inc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>3. Lance automático</h2>
      <p>
        Você pode definir um teto. O sistema dá lances por você, sempre no menor valor necessário para manter
        a liderança, até esse teto. Seu teto é secreto: só você o vê. Em caso de tetos iguais, vence quem
        registrou primeiro. Se um lance manual empatar com um teto já registrado, o teto anterior mantém a
        liderança.
      </p>
      <h2>4. Prorrogação nos minutos finais</h2>
      <p>
        Um lance recebido nos últimos 2 minutos estende o encerramento em mais 2 minutos, até 5 vezes. Isso dá
        a todos a chance de responder e evita vitórias por lance de última hora.
      </p>
      <h2>5. Quem pode dar lance</h2>
      <p>
        É preciso estar logado com uma conta ativa. O vendedor não pode dar lance no próprio anúncio, e é
        proibido usar outras contas para isso. Use apenas uma conta: lances combinados para inflar preço levam
        a suspensão.
      </p>
      <h2>6. Fim do prazo de lances</h2>
      <p>
        No horário de encerramento (o do servidor, não o do seu aparelho), o maior lance válido vence e um
        pedido é criado. Sem lances, o anúncio encerra sem vencedor e o vendedor pode relançá-lo com 1 clique,
        com um valor inicial menor se quiser.
      </p>
      <h2>7. Histórico público</h2>
      <p>
        Todo lance fica registrado de forma imutável. O histórico é público com identidade mascarada (por
        exemplo, “j***a”).
      </p>
      <h2>8. Taxa de proteção do comprador</h2>
      <p>
        Quem vence paga o valor do lance mais uma taxa de proteção de 3%. O total aparece antes de você
        confirmar o lance e no pedido. Detalhes em <Link to="/termos#taxas">Termos, seção 11</Link>.
      </p>
      <h2>9. Itens vendidos no estado</h2>
      <p>
        Anúncios “No estado / para peças” pedem um aceite extra antes do primeiro lance: o item pode não
        funcionar e não tem garantia de funcionamento. Veja{' '}
        <Link to="/termos#no-estado">Termos, seção 10</Link>.
      </p>
      <p>
        Veja também os <Link to="/termos">Termos de Uso</Link> e os{' '}
        <Link to="/itens-proibidos">itens proibidos</Link>.
      </p>
    </main>
  );
}

const HELP_FAQ: Faq[] = [
  {
    q: 'Como dou um lance?',
    a: 'Abra o anúncio, escolha um valor igual ou maior que o mínimo exibido, marque a confirmação de compromisso de compra e toque em “Confirmar lance”. É preciso estar logado.',
  },
  {
    q: 'O que é o lance automático?',
    a: 'Você informa o valor máximo que aceita pagar e o sistema cobre outros lances por você, sempre no menor valor necessário, até esse limite. Ninguém vê o seu teto.',
  },
  {
    q: 'Posso cancelar um lance?',
    a: 'Não. Todo lance confirmado é compromisso de compra. Confira o valor com atenção antes de confirmar.',
  },
  {
    q: 'Por que o prazo de lances foi prorrogado?',
    a: 'Lances nos últimos 2 minutos estendem o encerramento em 2 minutos, até 5 vezes, para que todos possam responder.',
  },
  {
    q: 'Quanto custa vender?',
    a: 'Anunciar é grátis. Há uma comissão de 5% apenas quando o item é vendido.',
  },
  {
    q: 'Quanto custa comprar?',
    a: 'Quem vence paga o valor do lance mais uma taxa de proteção de 3%. O total aparece antes de você confirmar o lance.',
  },
  {
    q: 'O que significa “No estado / para peças”?',
    a: 'O item é vendido como está e pode não funcionar. Antes de dar lance, você aceita essas condições. Só cabe disputa se o item não chegar, for diferente do anunciado ou tiver defeito omitido pelo vendedor.',
  },
  {
    q: 'Como acompanho um anúncio?',
    a: 'Toque em “Seguir anúncio” na página do anúncio. Anúncios em que você deu lance são seguidos automaticamente e aparecem em “Meus lances”.',
  },
  {
    q: 'O pagamento já funciona?',
    a: 'Ainda não. O pagamento protegido será liberado em breve. Nenhum valor é cobrado enquanto isso.',
  },
  {
    q: 'Encontrei um anúncio suspeito. O que faço?',
    a: 'Use o botão “Denunciar anúncio” na página do item. A moderação analisa todas as denúncias.',
  },
];
const HELP_FAQ_LD = faqLd(HELP_FAQ);

export function HelpPage() {
  useDocumentMeta({
    title: 'Ajuda e perguntas frequentes',
    description: 'Tire dúvidas sobre lances, lance automático, prorrogação, vendas e denúncias no MeuLance.',
    canonicalPath: '/ajuda',
  });
  useJsonLd('ld-faq', HELP_FAQ_LD);
  return (
    <main className="page simple legal-page">
      <span className="kicker">CENTRAL DE AJUDA</span>
      <h1>Perguntas frequentes</h1>
      <p>Não achou o que procurava? Leia as regras completas da venda por lances ou os termos de uso.</p>
      <div className="faq-list">
        {HELP_FAQ.map(({ q, a }) => (
          <details key={q} className="faq-item">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <div className="hero-actions">
        <Link className="btn secondary" to="/regras-de-lance">
          Regras da venda por lances
        </Link>
        <Link className="btn secondary" to="/como-funciona">
          Como funciona
        </Link>
        <Link className="btn" to="/suporte">
          Falar com o suporte
        </Link>
      </div>
    </main>
  );
}

export function SupportPage() {
  useDocumentMeta({
    title: 'Suporte',
    description: 'Fale com o suporte do MeuLance pelo WhatsApp e tire suas dúvidas.',
    canonicalPath: '/suporte',
  });
  return (
    <main className="page simple legal-page">
      <span className="kicker">SUPORTE</span>
      <h1>Fale com a gente</h1>
      <p>Ficou com dúvida sobre um leilão, um pedido ou sua conta? Chame o suporte pelo WhatsApp.</p>
      <div className="hero-actions">
        <a
          className="btn"
          href={supportWhatsAppUrl('Olá! Preciso de ajuda com o MeuLance.')}
          target="_blank"
          rel="noopener noreferrer"
        >
          Chamar no WhatsApp · {SUPPORT_WHATSAPP_LABEL}
        </a>
        <Link className="btn secondary" to="/ajuda">
          Ver perguntas frequentes
        </Link>
      </div>
      <p>{SUPPORT_HOURS}</p>
      <p>
        Dica: informe o link do anúncio ou o número do pedido para agilizar. Nunca envie senhas, códigos de
        verificação ou dados de cartão. O suporte não pede esses dados.
      </p>
    </main>
  );
}

export function PrivacyPage() {
  useDocumentMeta({
    title: 'Política de Privacidade',
    description: 'Política de Privacidade do MeuLance: dados coletados, finalidades e direitos do titular.',
    canonicalPath: '/privacidade',
  });
  return (
    <main className="page simple legal-page">
      <span className="kicker">MEULANCE</span>
      <h1>Política de Privacidade</h1>
      <h2>1. Dados que tratamos</h2>
      <p>
        <b>Conta:</b> nome, apelido de exibição, e-mail, telefone e cidade/estado. Se você entrar com o
        Google, recebemos nome, e-mail e foto do seu perfil Google.
      </p>
      <p>
        <b>Vendedores e compradores:</b> CPF, endereço, documento de identidade e foto de verificação
        (selfie), quando exigidos para vender ou comprar; IMEI de celulares anunciados.
      </p>
      <p>
        <b>Uso da plataforma:</b> anúncios e fotos, lances, perguntas, mensagens de pedidos (inclusive
        mensagens bloqueadas por conterem dados de contato, que ficam registradas para análise de segurança),
        avaliações e denúncias.
      </p>
      <p>
        <b>Segurança:</b> identificador de dispositivo e IP em forma de hash, e sinais usados para detectar
        fraude e contas múltiplas.
      </p>
      <h2>2. Para que usamos</h2>
      <p>
        Operar os anúncios e pedidos, verificar identidade, prevenir fraude, contas múltiplas e negociação
        fora da plataforma, cumprir obrigações legais, atender disputas e enviar as notificações que você
        escolher.
      </p>
      <h2>3. O que é público</h2>
      <p>
        Apelido de exibição (nome e inicial do sobrenome), foto de perfil, cidade/UF, reputação, anúncios e
        histórico de lances com identidade mascarada. Nunca exibimos CPF, telefone, e-mail ou endereço exato.
        A localização dos anúncios é aproximada (cidade/UF).
      </p>
      <h2>4. O que a outra parte vê</h2>
      <p>
        Antes do pagamento de um pedido, comprador e vendedor se veem apenas pelo apelido. Depois que o
        pagamento é processado, o vendedor recebe o nome completo e o endereço do comprador para o envio, e o
        comprador recebe o nome do vendedor (e o endereço dele, se o item for de retirada). Telefone, e-mail e
        CPF não são compartilhados entre as partes.
      </p>
      <h2>5. Documentos e fotos de verificação</h2>
      <p>
        Documento de identidade e selfie ficam em armazenamento privado, acessíveis somente por você e pela
        equipe do MeuLance para a análise de verificação. Não são exibidos a outros usuários.
      </p>
      <h2>6. Compartilhamento</h2>
      <p>
        Com prestadores de infraestrutura e autenticação (hospedagem, banco de dados, login com Google), com o
        provedor de pagamento quando ativado e com autoridades quando exigido por lei. Dados de cartão nunca
        passam pelos nossos servidores.
      </p>
      <h2>7. Retenção</h2>
      <p>
        Guardamos os dados pelo tempo necessário para operar o serviço, prevenir fraude e cumprir obrigações
        legais. O IMEI é apagado 20 dias após a conclusão do pedido. Fotos e mensagens de disputas são
        apagadas 30 dias após a decisão. Dados de anúncios encerrados são removidos periodicamente.
      </p>
      <h2>8. Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção, portabilidade e exclusão dos seus dados, além de revogar
        consentimentos, conforme a LGPD. Canal do titular e encarregado: a definir.
      </p>
    </main>
  );
}
