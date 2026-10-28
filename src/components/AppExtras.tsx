"use client";
import { useEffect, useState } from "react";
import { canPrompt, isInstalled, isIOS, onInstallChange, promptInstall, registerServiceWorker } from "@/lib/pwa";
import { setDataSaver, useDataSaver } from "@/lib/dataSaver";
import Sheet from "./Sheet";
import Icon from "./Icon";
import { useToast } from "./Toast";

/** Registers the service worker once. */
export function ServiceWorker() {
  useEffect(() => { registerServiceWorker(); }, []);
  return null;
}

/** Menu row: install Den on the home screen. Hidden once Den is installed. */
export function InstallDen({ className = "side-link" }: { className?: string }) {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [howTo, setHowTo] = useState(false);
  useEffect(() => {
    const sync = () => { setReady(canPrompt()); setInstalled(isInstalled()); };
    sync();
    return onInstallChange(sync);
  }, []);
  if (installed) return null;
  async function install() {
    if (ready) {
      const r = await promptInstall();
      if (r === "accepted") toast("Den is on your home screen.");
      return;
    }
    setHowTo(true);
  }
  return (
    <>
      <button type="button" className={`${className} theme-row`} onClick={install}>
        <Icon name="download" size={21} /><span>Install Den</span><em>App</em>
      </button>
      {howTo && (
        <Sheet title="Install Den" onClose={() => setHowTo(false)}>
          <p className="note">Den works like an app from your home screen: its own icon, full screen, no app store needed.</p>
          {isIOS() ? (
            <ol className="howto">
              <li>Open Den in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button (the square with an arrow).</li>
              <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
            </ol>
          ) : (
            <ol className="howto">
              <li>Open Den in <b>Chrome</b>.</li>
              <li>Tap the <b>⋮</b> menu at the top right.</li>
              <li>Tap <b>Add to Home screen</b> or <b>Install app</b>, then <b>Install</b>.</li>
            </ol>
          )}
        </Sheet>
      )}
    </>
  );
}

/** Menu row: data saver on/off (photos load only when tapped). */
export function DataSaverToggle({ className = "side-link" }: { className?: string }) {
  const on = useDataSaver();
  const toast = useToast();
  return (
    <button type="button" role="switch" aria-checked={on} className={`${className} theme-row`}
      onClick={() => { setDataSaver(!on); toast(!on ? "Data saver on: photos load when you tap them." : "Data saver off"); }}>
      <Icon name="image" size={21} /><span>Data saver</span>
      <span className={`switch ${on ? "on" : ""}`} aria-hidden="true" />
    </button>
  );
}
