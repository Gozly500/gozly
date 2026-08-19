import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TiltCard from "@/components/TiltCard";

export default function HomePage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="hero">
        <div className="wrap">
          <div className="hero-title">Gozly</div>
          <div className="hero-slogan">
            Des outils numériques modulaires pour les PME qui veulent tout gérer au même endroit.
          </div>
          <div className="hero-ctas">
            <Link href="/contact" className="btn-pill-dark">
              Démarrer un projet →
            </Link>
            <a href="#services" className="btn-pill-glass">
              Voir les modules
            </a>
          </div>
        </div>
      </header>

      <section id="services">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Ce qu&apos;on construit</div>
            <h2>Votre système, votre contrôle.</h2>
            <p>
              Chaque module s&apos;ajoute à ton propre tableau de bord - tu ne payes que pour ce dont
              tu as besoin, quand tu en as besoin.
            </p>
          </div>
          <div className="services">
            <div className="service-card">
              <div className="badge b-1">◆</div>
              <h3>Site vitrine</h3>
              <p>Un site rapide, moderne et à ton image pour présenter ton entreprise et convertir tes visiteurs.</p>
              <span className="wix-tag">Propulsé par Wix</span>
            </div>
            <div className="service-card">
              <div className="badge b-2">▦</div>
              <h3>Dashboard sur mesure</h3>
              <p>Un espace privé pour toi et ton équipe, qui centralise l&apos;information au lieu de l&apos;éparpiller.</p>
            </div>
            <div className="service-card">
              <div className="badge b-3">◷</div>
              <h3>Planning &amp; horaire</h3>
              <p>Un planning simple à mettre à jour, affiché où ton équipe en a besoin - même sur une tablette partagée.</p>
            </div>
            <div className="service-card">
              <div className="badge b-4">✓</div>
              <h3>Pointage</h3>
              <p>Suivi des heures travaillées, simple pour les employés, clair pour toi au moment de la paie.</p>
            </div>
            <div className="service-card">
              <div className="badge b-5">▤</div>
              <h3>Inventaire &amp; ventes</h3>
              <p>Un suivi de stock qui se met à jour avec tes ventes, pour ne plus jamais être pris au dépourvu.</p>
            </div>
            <div className="service-card">
              <div className="badge b-6">✦</div>
              <h3>Et plus encore</h3>
              <p>D&apos;autres modules s&apos;ajoutent régulièrement à la plateforme, à mesure que de nouveaux besoins se présentent.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="process">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Notre philosophie</div>
            <h2>Pourquoi Gozly?</h2>
          </div>
          <div className="about-wrap">
            <div className="about-block">
              <p>
                Trop d&apos;agences numériques fonctionnent de la même façon : un gros projet sur mesure, un
                contrat signé d&apos;avance, plusieurs mois d&apos;attente - et une fois le produit livré, plus
                personne pour faire évoluer le système quand tes besoins changent. Résultat : tu payes
                cher pour un outil figé, qui ne bouge plus avec ton entreprise.
              </p>
              <p>
                Chez Gozly, on fait les choses autrement. <strong>On te livre une plateforme déjà prête</strong>,
                où tu actives seulement les modules dont tu as besoin - planning, pointage, inventaire, et
                plus encore. Pas de gros engagement de départ, pas d&apos;attente de six mois avant de voir
                un résultat concret.
              </p>
              <p>
                Ton système <strong>évolue avec toi</strong>: un nouveau besoin apparaît, tu actives un
                nouveau module. Rien à reconstruire, rien à jeter - et rien que tu payes sans t&apos;en
                servir.
              </p>
            </div>
            <div className="about-logo">
              <svg viewBox="0 0 1182 1182" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(0.136019,0,0,0.136019,590.551181,590.551181)">
                  <g transform="matrix(1,0,0,1,-4341.666667,-4341.666667)">
                    <g transform="matrix(1.736113,0,0,-1.736113,0,8680.555554)">
                      <g transform="matrix(1,0,0,1,193.559941,-68.202741)">
                        <path
                          d="M1330,4463C1251,4450 1107,4405 1035,4371C755,4240 546,4005 447,3709C407,3590 397,3500 402,3319C407,3180 411,3141 434,3065C502,2837 637,2636 820,2490L875,2447L878,2481C889,2610 939,2805 1000,2954C1144,3309 1421,3624 1755,3812C1919,3905 2178,3996 2332,4014C2388,4021 2389,4022 2378,4043C2359,4081 2208,4224 2136,4273C2007,4363 1857,4427 1710,4454C1634,4469 1396,4474 1330,4463Z"
                          style={{ fill: "white", fillRule: "nonzero" }}
                        />
                      </g>
                      <g transform="matrix(1,0,0,1,193.559941,-68.202741)">
                        <path
                          d="M2437,3920C1945,3858 1524,3603 1258,3205C1072,2927 980,2626 980,2292C980,2109 996,1998 1044,1838C1182,1385 1469,1042 1885,835C2034,761 2151,720 2312,688C2407,669 2455,665 2610,666C2769,667 2812,671 2920,693C3095,730 3214,770 3365,844C3531,925 3648,1009 3775,1135C3978,1338 4120,1606 4180,1899C4218,2089 4225,2364 4195,2548C4176,2666 4145,2792 4136,2796C4125,2800 2593,2407 2585,2398C2580,2393 2724,1853 2732,1844C2736,1841 2915,1884 3130,1940C3345,1997 3523,2040 3527,2037C3539,2024 3509,1923 3471,1848C3392,1689 3255,1558 3072,1462C2895,1371 2720,1331 2540,1344C2308,1360 2113,1447 1946,1609C1651,1895 1568,2330 1740,2697C1860,2955 2068,3130 2355,3217C2437,3241 2460,3244 2610,3244C2753,3245 2786,3242 2854,3222C2996,3181 3122,3113 3236,3015L3277,2980L3481,3162C3593,3261 3707,3363 3734,3387L3783,3431L3759,3456C3722,3497 3591,3603 3525,3647C3386,3739 3166,3838 3020,3874C2835,3919 2583,3939 2437,3920Z"
                          style={{ fill: "white", fillRule: "nonzero" }}
                        />
                      </g>
                      <g transform="matrix(1,0,0,1,193.559941,-68.202741)">
                        <path
                          d="M2435,3120C2315,3093 2226,3056 2135,2995C1923,2854 1788,2623 1764,2361L1757,2287L1783,2294C2070,2366 2343,2584 2480,2851C2528,2945 2580,3085 2580,3121C2580,3145 2544,3145 2435,3120Z"
                          style={{ fill: "white", fillRule: "nonzero" }}
                        />
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Tarifs</div>
            <h2>Trois paliers, un seul système.</h2>
          </div>
          <div className="pricing">
            <TiltCard className="price-card tilt-card">
              <div className="price-head">
                <div className="price-icon pi-1"></div>
                <h3>Opale</h3>
              </div>
              <div className="price">
                25$<span>/mois</span>
              </div>
              <ul>
                <li>3 modules</li>
                <li>Assistance standard</li>
                <li>Mises à jour essentielles</li>
              </ul>
              <Link href="/contact" className="price-btn">
                Choisir ce forfait
              </Link>
            </TiltCard>
            <TiltCard className="price-card featured tilt-card">
              <div className="price-head">
                <div className="price-icon pi-2"></div>
                <h3>Onyx</h3>
              </div>
              <div className="price">
                40$<span>/mois</span>
              </div>
              <ul>
                <li>5 modules</li>
                <li>Support prioritaire</li>
                <li>Mises à jour avancées</li>
              </ul>
              <Link href="/contact" className="price-btn">
                Choisir ce forfait
              </Link>
            </TiltCard>
            <TiltCard className="price-card tilt-card">
              <div className="price-head">
                <div className="price-icon pi-3"></div>
                <h3>Crystal</h3>
              </div>
              <div className="price">
                50$<span>/mois</span>
              </div>
              <ul>
                <li>Modules illimités</li>
                <li>Assistance prioritaire</li>
                <li>Mises à jour avancées</li>
              </ul>
              <Link href="/contact" className="price-btn">
                Choisir ce forfait
              </Link>
            </TiltCard>
          </div>
        </div>
      </section>

      <section className="promo">
        <div className="wrap promo-wrap">
          <div className="promo-big top">1 mois!?</div>
          <div className="promo-card">
            <div className="promo-icon">
              <svg viewBox="0 0 1182 1182" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1.15332,0,0,1.15332,19.876162,42.135557)">
                  <path
                    d="M781.964,620.493C784.163,723.181 675.601,764.286 674.45,765.445C671.881,768.031 687.945,814.103 686.085,816.064C685.404,816.782 599.133,839.491 591.6,841.824C587.617,843.058 588.347,840.236 579.865,810.402C574.911,792.977 576.221,790.917 572.504,791.062C553.779,791.794 442.131,802.313 396.612,695.454C396.405,694.969 394.178,689.74 395.736,688.926C399.075,687.181 461.751,671.031 467.511,669.547C489.736,663.82 490.473,662.486 491.581,664.435C494.353,669.312 506.878,697.966 543.461,706.658C543.675,706.709 552.739,709.654 551.664,705.467C548.243,692.133 524.648,605.266 522.283,596.557C519.621,586.757 519.36,583.602 516.498,583.541C456.971,582.268 373.234,578.418 353.531,477.494C343.914,428.233 364.624,365.266 441.604,324.704C446.226,322.269 448.295,322.697 447.024,317.61C443.445,303.28 434.056,272.58 435.212,271.278C436.563,269.757 491.363,256.058 522.407,247.172C532.105,244.397 532.644,245.107 533.181,246.589C535.017,251.657 545.335,295.239 547.333,295.912C554.917,298.468 649.725,280.62 698.054,369.749C698.832,371.184 706.781,385.844 705.729,388.649C705.553,389.118 705.393,388.98 665.625,399.935C661.377,401.105 618.249,412.986 612.468,414.339C606.991,415.621 606.055,397.876 580.348,384.814C579.578,384.422 569.209,379.153 569.804,382.498C570.545,386.658 571.749,386.241 583.583,433.48C584.684,437.874 596.937,486.788 598.846,488.013C604.862,491.877 724.921,468.05 768.093,560.687C781.558,589.581 781.671,616.808 781.964,620.493ZM449.072,440.487C449.175,445.53 447.331,482.31 490.496,486.392C494.379,486.759 491.6,483.773 474.443,419.513C471.404,408.133 470.594,402.33 468.699,403.853C450.441,418.529 449.279,437.169 449.072,440.487ZM641.585,587.064C640.318,586.785 627.068,583.873 625.547,584.611C623.635,585.54 624.862,586.344 631.314,610.556C632.867,616.383 649.051,677.117 650.891,683.349C651.296,684.718 652.887,685.651 666.171,674.121C668.923,671.732 686.53,656.451 684.653,632.489C681.526,592.55 643.276,587.487 641.585,587.064Z"
                    style={{ fill: "white" }}
                  />
                </g>
                <g transform="matrix(1.15332,0,0,1.15332,19.876162,42.135557)">
                  <path
                    d="M313.444,104.041C330.176,101.34 367.724,100.11 409.46,114.615C450.514,128.883 479.183,155.888 484.302,160.71C509.565,184.507 525.188,213.448 527.11,218.572C527.694,220.129 526.522,220.042 507.463,225.362C492.729,229.474 405.375,252.474 404.469,253.473C403.074,255.01 418.896,306.646 418.161,308.402C417.268,310.532 380.007,329.888 355.061,366.192C297.448,450.034 344.424,520.729 341.38,524.394C339.36,526.826 259.687,526.64 199.856,473.084C63.136,350.701 129.956,128.71 313.444,104.041Z"
                    style={{ fill: "white" }}
                  />
                </g>
              </svg>
            </div>
            <div className="promo-text">
              <p>Mais oui! Profitez d&apos;un mois entièrement gratuit sur tous nos forfaits.</p>
              <a href="#pricing" className="promo-btn">
                Voir les forfaits →
              </a>
            </div>
          </div>
          <div className="promo-big bottom">Gratuit</div>
        </div>
      </section>

      <section id="contact-cta">
        <div className="wrap">
          <div className="cta-band">
            <h2>Prêt à arrêter de jongler avec dix outils?</h2>
            <p>Parle-nous de ton entreprise - on te propose une première étape simple.</p>
            <Link href="/contact" className="btn-pill-dark">
              Démarrer un projet →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
