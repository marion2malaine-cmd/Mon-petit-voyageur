import { useEffect, useRef, useState } from "react";
import { api } from "./api";
type GuideImage = { image: string; title: string };
async function prepareImage(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 20000000) throw new Error("Choisissez une image de moins de 20 Mo.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.85, .65, .45, .25]) {
      const image = canvas.toDataURL("image/jpeg", quality);
      if (image.length <= 250000) return image;
    }
    throw new Error("Image trop volumineuse. Choisissez une image plus petite.");
  } finally { bitmap.close(); }
}
export default function GuideImages({ tripId }: { tripId: number }) {
  const [images, setImages] = useState<GuideImage[]>([]);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => { let active = true; api.getGuideImages(tripId).then(data => { if (active) { setImages(data); setReady(true); } }).catch(() => { if (active) setError("Impossible de charger les images. Rechargez la page pour réessayer."); }); return () => { active = false; }; }, [tripId]);
  async function run(action: () => Promise<void>) {
    if (lock.current || !ready) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  async function add(files: Blob[]) {
    if (!files.length) throw new Error("Copiez l’image elle-même avec « Copier l’image », puis collez-la ici. Vous pouvez aussi importer le fichier enregistré.");
    if (images.length + files.length > 12) throw new Error("Vous pouvez ajouter jusqu’à 12 images par guide.");
    const added = await Promise.all(files.map(async file => ({ image: await prepareImage(file), title: "" })));
    setImages(await api.saveGuideImages(tripId, [...images, ...added])); setMessage("Images enregistrées dans le guide.");
  }
  return <details style={{ width: "100%" }}><summary>Ajouter des images au guide</summary>
    <p>Dans Google Images, ouvrez l’image puis faites un clic droit → Copier l’image. Collez-la ci-dessous avec ⌘V ou Ctrl+V. Les images sont ajoutées dans la section « Mes images du voyage » du guide, y compris le PDF.</p>
    <a href="https://www.google.com/search?udm=2" target="_blank" rel="noreferrer">Ouvrir Google Images ↗</a>
    <div role="group" aria-label="Zone de collage des images" tabIndex={0} style={{ border: "2px dashed #648b87", padding: 20, borderRadius: 12, margin: "12px 0" }} onPaste={event => {
      event.preventDefault(); const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith("image/")); void run(() => add(files));
    }}>Cliquez ici, puis collez votre image.</div>
    <button className="secondary" disabled={!ready || busy || images.length >= 12} onClick={() => void run(async () => {
      if (!navigator.clipboard?.read) throw new Error("Utilisez ⌘V ou Ctrl+V dans la zone de collage, ou importez un fichier.");
      let items: ClipboardItem[];
      try { items = await navigator.clipboard.read(); } catch { throw new Error("Le navigateur ne permet pas la lecture. Collez avec ⌘V ou Ctrl+V dans la zone, ou importez un fichier."); }
      const files: Blob[] = [];
      for (const item of items) { const type = item.types.find(t => t.startsWith("image/")); if (type) files.push(await item.getType(type)); }
      await add(files);
    })}>Coller une image</button>
    <label style={{ display: "block", margin: "12px 0" }}>Ou importer des images <input type="file" accept="image/*" multiple disabled={!ready || busy || images.length >= 12} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void run(() => add(files)); }}/></label>
    <p>{images.length}/12 images · Enregistrées avec ce voyage.</p>
    {images.map((p, index) => <figure key={index} style={{ margin: "12px 0" }}><img src={p.image} alt={p.title || `Image ${index + 1}`} style={{ maxWidth: "100%", maxHeight: 180 }}/>
      <input aria-label={`Légende de l’image ${index + 1}`} placeholder="Légende / crédit de l’image" maxLength={120} value={p.title} disabled={busy} onChange={e => { setImages(images.map((item, i) => i === index ? { ...item, title: e.target.value } : item)); setMessage("Légende modifiée : cliquez sur Enregistrer les légendes."); }}/>
      <button className="secondary" disabled={busy} onClick={() => void run(async () => { setImages(await api.saveGuideImages(tripId, images.filter((_, i) => i !== index))); setMessage("Image retirée du guide."); })}>Retirer</button></figure>)}
    {images.length > 0 && <button disabled={busy} onClick={() => void run(async () => { setImages(await api.saveGuideImages(tripId, images)); setMessage("Légendes enregistrées."); })}>Enregistrer les légendes</button>}
    {busy && <p role="status">Enregistrement…</p>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="error-text">{error}</p>}
  </details>;
}
