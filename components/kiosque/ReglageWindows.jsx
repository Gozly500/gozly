"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { SaisieGozly, ChampGozly } from "@/components/saisie/SaisieGozly";
import { pontWindows } from "@/lib/appareilWindows";
import { saisieGozlyActive } from "@/lib/saisieGozly";

// Réglages de l'appareil dans l'app Windows du kiosque (le kiosque est en plein écran : on n'a plus accès à Windows) :
// volume, luminosité, Bluetooth, Wi-Fi, et les paramètres de Windows eux-mêmes avec le code administrateur de Gozly.
export default function ReglageWindows() {
  const { t } = useLangue();
  const [etat, setEtat] = useState(null); // { volume, muet, luminosite, bluetooth } ; null tant que ce n'est pas lu
  const [volume, setVolume] = useState(50);
  const [luminosite, setLuminosite] = useState(50);
  const [wifi, setWifi] = useState({ ssid: null });
  const [reseaux, setReseaux] = useState(null); // null = pas encore cherchés
  const [recherche, setRecherche] = useState(false);
  const [choisi, setChoisi] = useState(null); // réseau en cours de connexion
  const [motDePasse, setMotDePasse] = useState("");
  const [message, setMessage] = useState(null); // { ok, texte }
  const [occupe, setOccupe] = useState(false);
  const [appareilsBt, setAppareilsBt] = useState(null); // null = pas encore cherchés
  const [rechercheBt, setRechercheBt] = useState(false);
  const [btOccupe, setBtOccupe] = useState(null); // id de l'appareil en cours de jumelage ou de retrait
  const [codeOuvert, setCodeOuvert] = useState(false);
  const [code, setCode] = useState("");
  const [tablette, setTablette] = useState(false);
  const pont = useRef(null);

  useEffect(() => {
    pont.current = pontWindows();
    setTablette(saisieGozlyActive());
  }, []);

  const lire = useCallback(async () => {
    const p = pontWindows();
    if (!p) return;
    const [e, w] = await Promise.all([p.etat(), p.wifiEtat()]);
    if (e?.ok !== false) {
      setEtat(e);
      if (typeof e.volume === "number") setVolume(e.volume);
      if (typeof e.luminosite === "number") setLuminosite(e.luminosite);
    }
    setWifi(w || { ssid: null });
  }, []);

  useEffect(() => {
    lire();
  }, [lire]);

  const afficher = (ok, texte) => setMessage({ ok, texte });

  async function changerVolume(n) {
    const r = await pont.current.volume(n);
    if (r?.ok === false) afficher(false, t("kq.win.echec"));
  }
  async function basculerMuet() {
    const r = await pont.current.muet(!etat.muet);
    if (r?.ok !== false) setEtat((e) => ({ ...e, muet: r.muet }));
  }
  async function changerLuminosite(n) {
    const r = await pont.current.luminosite(n);
    if (r?.ok === false) afficher(false, t("kq.win.echec"));
  }
  async function basculerBluetooth() {
    setOccupe(true);
    const r = await pont.current.bluetooth(!etat.bluetooth);
    setOccupe(false);
    if (r?.ok === false) afficher(false, t("kq.win.btEchec"));
    else setEtat((e) => ({ ...e, bluetooth: r.bluetooth }));
  }

  async function chercherAppareilsBt() {
    setRechercheBt(true);
    setMessage(null);
    const r = await pont.current.bluetoothAppareils();
    setRechercheBt(false);
    if (r?.ok === false) return afficher(false, t("kq.win.btRechercheEchec"));
    setAppareilsBt(r.appareils || []);
  }

  async function jumelerBt(a) {
    setBtOccupe(a.id);
    setMessage(null);
    const r = await pont.current.bluetoothJumeler(a.id);
    setBtOccupe(null);
    if (r?.ok === false) return afficher(false, t("kq.win.btJumelageEchec", { nom: a.nom }));
    setAppareilsBt((l) => l.map((x) => (x.id === a.id ? { ...x, jumele: true } : x)));
    afficher(true, t("kq.win.btJumele", { nom: a.nom }));
  }

  async function retirerBt(a) {
    setBtOccupe(a.id);
    setMessage(null);
    const r = await pont.current.bluetoothRetirer(a.id);
    setBtOccupe(null);
    if (r?.ok === false) return afficher(false, t("kq.win.btRetraitEchec", { nom: a.nom }));
    setAppareilsBt((l) => l.map((x) => (x.id === a.id ? { ...x, jumele: false } : x)));
    afficher(true, t("kq.win.btRetire", { nom: a.nom }));
  }

  async function chercherReseaux() {
    setRecherche(true);
    setMessage(null);
    const r = await pont.current.wifiReseaux();
    setRecherche(false);
    if (r?.ok === false) return afficher(false, t("kq.win.echec"));
    setReseaux(r.reseaux || []);
  }

  async function connecter(reseau, mdp = "") {
    setOccupe(true);
    setMessage(null);
    const r = await pont.current.wifiConnecter(reseau.ssid, mdp);
    setOccupe(false);
    if (r?.ok) {
      afficher(true, t("kq.win.wifiOk", { nom: reseau.ssid }));
      setChoisi(null);
      setMotDePasse("");
      lire();
      return;
    }
    const cles = { mot_de_passe_requis: "kq.win.wifiMdp", non_supporte: "kq.win.wifiNonSupporte", mot_de_passe_ou_delai: "kq.win.wifiMdpFaux", introuvable: "kq.win.wifiIntrouvable" };
    afficher(false, t(cles[r?.erreur] || "kq.win.wifiEchec"));
  }

  function toucherReseau(reseau) {
    setMessage(null);
    if (reseau.connu || !reseau.securise) return connecter(reseau);
    setChoisi(reseau);
    setMotDePasse("");
  }

  async function ouvrirParametres() {
    setOccupe(true);
    const r = await pont.current.ouvrirParametres(code);
    setOccupe(false);
    if (r?.ok) {
      setCode("");
      setCodeOuvert(false);
      return;
    }
    const cles = { reseau: "kq.win.codeReseau", trop_d_essais: "kq.win.codeTrop", non_configure: "kq.win.codeNonConfigure" };
    afficher(false, t(cles[r?.erreur] || "kq.win.codeFaux"));
    setCode("");
  }

  const curseur = (valeur, onChange, onFin, etiquette) => (
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={valeur}
      aria-label={etiquette}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onFin(Number(e.currentTarget.value))}
      onKeyUp={(e) => onFin(Number(e.currentTarget.value))}
      style={{ flex: 1, minWidth: "160px", height: "32px" }}
    />
  );

  const interrupteur = (actif, onChange, desactive) => (
    <label className="switch">
      <input type="checkbox" checked={!!actif} disabled={desactive} onChange={onChange} />
      <span className="switch-track"></span>
      <span className="switch-thumb"></span>
    </label>
  );

  if (!etat) return <p className="panel-hint">{t("kq.chargement")}</p>;

  return (
    <SaisieGozly actif={tablette}>
      <div>
        {message && <p style={{ color: message.ok ? "#7ee2a8" : "#ff9494", margin: "0 0 12px" }}>{message.texte}</p>}

        <h3 style={{ marginBottom: "4px" }}>{t("kq.win.son")}</h3>
        {typeof etat.volume === "number" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
            {curseur(volume, setVolume, changerVolume, t("kq.win.son"))}
            <strong style={{ minWidth: "44px" }}>{volume} %</strong>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {t("kq.win.muet")} {interrupteur(etat.muet, basculerMuet)}
            </span>
          </div>
        ) : (
          <p className="panel-hint">{t("kq.win.indisponible")}</p>
        )}

        <h3 style={{ marginBottom: "4px" }}>{t("kq.win.luminosite")}</h3>
        {typeof etat.luminosite === "number" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
            {curseur(luminosite, setLuminosite, changerLuminosite, t("kq.win.luminosite"))}
            <strong style={{ minWidth: "44px" }}>{luminosite} %</strong>
          </div>
        ) : (
          <p className="panel-hint" style={{ marginBottom: "18px" }}>{t("kq.win.luminositeNon")}</p>
        )}

        <h3 style={{ marginBottom: "4px" }}>{t("kq.win.bluetooth")}</h3>
        {typeof etat.bluetooth === "boolean" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            {interrupteur(etat.bluetooth, basculerBluetooth, occupe)}
            <span>{etat.bluetooth ? t("kq.win.active") : t("kq.win.desactive")}</span>
          </div>
        ) : (
          <p className="panel-hint">{t("kq.win.btAbsent")}</p>
        )}
        {typeof etat.bluetooth === "boolean" && etat.bluetooth && (
          <>
            <button type="button" className="admin-icon-btn" disabled={rechercheBt || !!btOccupe} onClick={chercherAppareilsBt}>
              {rechercheBt ? t("kq.win.btRecherche") : t("kq.win.btChercher")}
            </button>
            {appareilsBt && (
              <div className="moi-settings-list" style={{ marginTop: "10px" }}>
                {appareilsBt.length === 0 && <p className="panel-hint">{t("kq.win.btAucun")}</p>}
                {appareilsBt.map((a) => (
                  <div key={a.id} className="moi-settings-item" style={{ cursor: "default" }}>
                    <span className="moi-settings-item-emoji">🎧</span>
                    <span className="moi-settings-item-text">
                      <strong>{a.nom}</strong>
                      <span>{a.jumele ? t("kq.win.btJumeleTag") : t("kq.win.btProche")}</span>
                    </span>
                    <button
                      type="button"
                      className={a.jumele ? "admin-icon-btn" : "submit-btn"}
                      disabled={!!btOccupe || rechercheBt}
                      onClick={() => (a.jumele ? retirerBt(a) : jumelerBt(a))}
                    >
                      {btOccupe === a.id ? t("kq.win.btEnCours") : a.jumele ? t("kq.win.btRetirer") : t("kq.win.btJumeler")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <p className="panel-hint" style={{ margin: "8px 0 18px" }}>{t("kq.win.btAide")}</p>

        <h3 style={{ marginBottom: "4px" }}>{t("kq.win.wifi")}</h3>
        <p className="panel-hint">{wifi.ssid ? t("kq.win.wifiConnecte", { nom: wifi.ssid }) : t("kq.win.wifiPasConnecte")}</p>
        <button type="button" className="admin-icon-btn" disabled={recherche || occupe} onClick={chercherReseaux}>
          {recherche ? t("kq.win.recherche") : t("kq.win.chercher")}
        </button>
        {reseaux && (
          <div className="moi-settings-list" style={{ marginTop: "10px" }}>
            {reseaux.length === 0 && <p className="panel-hint">{t("kq.win.aucunReseau")}</p>}
            {reseaux.map((r) => (
              <button
                key={r.ssid}
                type="button"
                className="moi-settings-item"
                disabled={occupe}
                onClick={() => toucherReseau(r)}
                style={r.ssid === wifi.ssid ? { borderColor: "#7ee2a8" } : undefined}
              >
                <span className="moi-settings-item-emoji">{r.securise ? "🔒" : "📶"}</span>
                <span className="moi-settings-item-text">
                  <strong>{r.ssid}</strong>
                  <span>
                    {t("kq.win.signal", { n: r.signal })}
                    {r.ssid === wifi.ssid ? ` · ${t("kq.win.actuel")}` : r.connu ? ` · ${t("kq.win.connu")}` : ""}
                    {!r.pris_en_charge ? ` · ${t("kq.win.nonSupporte")}` : ""}
                  </span>
                </span>
                <span className="moi-settings-item-chevron">›</span>
              </button>
            ))}
          </div>
        )}
        {choisi && (
          <div style={{ marginTop: "12px", padding: "12px 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px" }}>
            <strong>{t("kq.win.mdpPour", { nom: choisi.ssid })}</strong>
            <div style={{ margin: "8px 0" }}>
              <ChampGozly id="win-wifi-mdp" type="texte" label={t("kq.win.mdp")} placeholder={t("kq.win.mdp")} value={motDePasse} onChange={setMotDePasse} maxLength={63} style={{ width: "100%", boxSizing: "border-box", margin: 0 }} />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className="submit-btn" disabled={occupe || !motDePasse} onClick={() => connecter(choisi, motDePasse)}>
                {occupe ? t("kq.win.connexion") : t("kq.win.connecter")}
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => { setChoisi(null); setMotDePasse(""); }}>
                {t("kq.nip.annuler")}
              </button>
            </div>
          </div>
        )}

        <h3 style={{ margin: "24px 0 4px" }}>{t("kq.win.parametres")}</h3>
        <p className="panel-hint">{t("kq.win.parametresDesc")}</p>
        {!codeOuvert ? (
          <button type="button" className="admin-icon-btn" onClick={() => { setCodeOuvert(true); setMessage(null); }}>
            {t("kq.win.parametresBtn")}
          </button>
        ) : (
          <div style={{ padding: "12px 14px", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px" }}>
            <strong>{t("kq.win.codeTitre")}</strong>
            <div style={{ margin: "8px 0" }}>
              <ChampGozly id="win-code-admin" type="texte" masque label={t("kq.win.code")} placeholder={t("kq.win.code")} value={code} onChange={setCode} maxLength={100} style={{ width: "100%", boxSizing: "border-box", margin: 0 }} />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className="submit-btn" disabled={occupe || !code} onClick={ouvrirParametres}>
                {t("kq.win.ouvrir")}
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => { setCodeOuvert(false); setCode(""); }}>
                {t("kq.nip.annuler")}
              </button>
            </div>
          </div>
        )}
      </div>
    </SaisieGozly>
  );
}
