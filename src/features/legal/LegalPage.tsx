import { useEffect } from 'react'

import { VaultNoteIcon } from '@/components/ui/vault-note-icon'
import { dismissBootSplash } from '@/shared/boot'

export type LegalKind = 'privacy' | 'terms'

/**
 * Standalone public pages (`/privacy`, `/terms`) for the Google OAuth branding
 * verification links. Rendered outside `VaultGate` so they open without a vault;
 * honest and short, because reviewers actually read these.
 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  useEffect(() => {
    dismissBootSplash({ instant: true })
    document.title = kind === 'privacy' ? 'VaultNote — Gizlilik Politikası' : 'VaultNote — Kullanım Şartları'
  }, [kind])

  return (
    <div className="min-h-full bg-shell-gradient">
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <header className="mb-6 flex items-center gap-2.5">
          <VaultNoteIcon size={36} className="size-9 rounded-xl shadow-e1" />
          <span className="text-base font-semibold tracking-tight">
            Vault<span className="text-primary">Note</span>
          </span>
        </header>
        <article className="space-y-5 rounded-2xl border border-border/80 bg-background p-6 shadow-e2 md:p-8">
          {kind === 'privacy' ? <PrivacyBody /> : <TermsBody />}
        </article>
        <footer className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <a className="underline-offset-4 hover:underline" href="/privacy">
            Gizlilik Politikası · Privacy Policy
          </a>
          <a className="underline-offset-4 hover:underline" href="/terms">
            Kullanım Şartları · Terms of Service
          </a>
        </footer>
      </main>
    </div>
  )
}

function H({ children }: { children: string }) {
  return <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
}

function P({ children }: { children: string }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
}

function PrivacyBody() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Gizlilik Politikası</h1>
      <P>Son güncelleme: Ekim 2026. VaultNote, uçtan uca şifreli, sunucusuz bir not uygulamasıdır.</P>
      <section className="space-y-1.5">
        <H>Veri sorumlusu</H>
        <P>
          VaultNote&apos;un sunucusu ve hesabı yoktur; verileriniz cihazınızda ve sizin Google
          Drive hesabınızda durur. Bu yüzden verilerinizin denetimi teknik olarak sizdedir: biz
          notlarınıza erişemeyiz, göremeyiz, paylaşamayız.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Toplanan veriler ve kullanım amacı</H>
        <P>
          Not içerikleriniz (başlık, gövde, etiketler, defter adları) cihazınızda AES-256-GCM ile
          şifrelenir; şifreleme anahtarları parolanızdan Argon2id ile türetilir. Parolanız,
          anahtarlarınız ve notlarınızın açık hali cihazı asla terk etmez ve hiçbir sunucuya
          gönderilmez. Senkronizasyonu açarsanız yalnızca şifreli veri (çözülemeyen kriptolu
          dosyalar), sizin Google Drive hesabınızdaki uygulamaya özel klasöre (appDataFolder)
          yazılır; amaç cihazlarınız arasında taşımadır.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Google ile giriş ve izinler</H>
        <P>
          Google ile giriş yalnızca Drive erişimi içindir ve tek bir izin ister: drive.appdata
          (uygulamaya özel Drive klasörü). Google hesap kimliğiniz giriş anında belirteç almak
          için kullanılır, tarafımızca saklanmaz. Erişim belirteçleri yalnızca bellekte tutulur,
          kapatıp açınca silinir; Bağlantıyı kes düğmesi belirteci iptal eder. Kişiler, e-posta
          içeriği veya başka Drive dosyalarına erişim istenmez ve okunmaz.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Cihazda saklanan tercihler</H>
        <P>
          Tema, dil, yazı boyutu gibi görünüm tercihleri yalnızca bu cihazın yerel deposunda
          (localStorage) tutulur, hiçbir yere gönderilmez.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>İzleme ve paylaşım</H>
        <P>
          Analitik, çerez takibi, reklam, hata raporu gönderimi ve üçüncü taraflarla veri
          paylaşımı yoktur. Uygulama çevrimdışı çalışır. Drive&apos;da duran şifreli dosyalar
          için Google&apos;ın kendi gizlilik politikası geçerlidir.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Saklama süresi ve silme</H>
        <P>
          Yerel veriler uygulamayı sıfırlayana kadar (Ayarlar → Tehlikeli alan → Vault&apos;u
          sıfırla) cihazda kalır; kilitleyince şifreli notlar bellekten silinir. Drive&apos;daki
          şifreli kopya, siz Google Drive&apos;ınızdan silene kadar durur. Dışa aktardığınız
          dosyalar şifresizdir; sorumluluğu size aittir.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Haklarınız</H>
        <P>
          Verilerinize erişme, dışa aktarma ve silme işlemlerini uygulamanın içinden
          yapabilirsiniz (dışa aktar, içe aktar, sıfırla). Ek talep için aşağıdaki adresten
          ulaşın.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Çocuklar ve değişiklikler</H>
        <P>
          Uygulama 13 yaş altı çocuklara yönelik değildir ve çocuklardan bilerek veri
          toplanmaz. Bu politika değişirse güncelleme tarihiyle birlikte bu sayfada
          yayımlanır.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>İletişim</H>
        <P>Sorularınız için: https://github.com/kemaladlig/vault-note</P>
      </section>
      <hr className="border-border/60" />
      <h1 className="text-xl font-semibold tracking-tight">Privacy Policy</h1>
      <P>Last updated: October 2026. VaultNote is an end-to-end encrypted, serverless notes app.</P>
      <section className="space-y-1.5">
        <H>Data controller</H>
        <P>
          VaultNote has no servers and no accounts; your data lives on your device and in your
          own Google Drive account. Control of your data is technically yours: we cannot access,
          view, or share your notes.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Data collected and purpose</H>
        <P>
          Your note contents (titles, bodies, tags, notebook names) are encrypted on your device
          with AES-256-GCM; encryption keys are derived from your passphrase with Argon2id. Your
          passphrase, keys, and plaintext never leave the device and are never sent to any
          server. If you enable sync, only encrypted data (unreadable ciphertext files) is
          written to the app-specific folder (appDataFolder) in your Google Drive account, for
          the purpose of carrying it between your devices.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Google sign-in and permissions</H>
        <P>
          Google sign-in exists only for Drive access and requests a single permission:
          drive.appdata (the app-specific Drive folder). Your Google account identity is used
          only to obtain a token at sign-in and is not stored by us. Access tokens are kept in
          memory only and discarded on restart; the Disconnect button revokes the token. No
          access to contacts, email content, or other Drive files is requested or read.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>On-device preferences</H>
        <P>
          Appearance preferences such as theme, language, and font size stay in this
          device&apos;s local storage and are never transmitted.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Tracking and sharing</H>
        <P>
          No analytics, no cookie tracking, no ads, no crash-report uploads, and no sharing of
          data with third parties. The app works offline. Google&apos;s own privacy policy
          applies to the encrypted files stored in Drive.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Retention and deletion</H>
        <P>
          Local data stays on the device until you reset the app (Settings → Danger zone →
          Reset vault); locking wipes decrypted notes from memory. The encrypted Drive copy
          remains until you delete it from your Google Drive. Files you export are unencrypted;
          keeping them safe is your responsibility.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Your rights</H>
        <P>
          You can access, export, and delete your data inside the app (export, import, reset).
          Reach out at the address below for anything further.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Children and changes</H>
        <P>
          The app is not directed at children under 13, and no children&apos;s data is
          knowingly collected. If this policy changes, it will be published on this page with
          an updated date.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Contact</H>
        <P>Questions: https://github.com/kemaladlig/vault-note</P>
      </section>
    </>
  )
}

function TermsBody() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Kullanım Şartları</h1>
      <P>Son güncelleme: Ekim 2026.</P>
      <section className="space-y-1.5">
        <H>Hizmet</H>
        <P>
          VaultNote, notlarınızı cihazınızda şifreleyen ücretsiz bir uygulamadır. Hesap sistemi
          yoktur; verileriniz sizde kalır.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Parola sorumluluğu</H>
        <P>
          Parolanızı yalnızca siz bilirsiniz. Unutup bu cihazı da unuttuysanız kurtarma yolu
          yoktur; bu teknik bir sınırlama değil, uçtan uca şifrelemenin gereğidir.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Garanti yok</H>
        <P>
          Uygulama &quot;olduğu gibi&quot; sunulur; veri kaybına karşı düzenli dışa aktarım
          almanız önerilir. Yasalara aykırı içeriklerden kullanıcı sorumludur.
        </P>
      </section>
      <hr className="border-border/60" />
      <h1 className="text-xl font-semibold tracking-tight">Terms of Service</h1>
      <P>Last updated: October 2026.</P>
      <section className="space-y-1.5">
        <H>Service</H>
        <P>
          VaultNote is a free app that encrypts your notes on your device. There is no account
          system; your data stays with you.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>Passphrase responsibility</H>
        <P>
          Only you know your passphrase. If you lose it and the device is forgotten too, there
          is no recovery — a property of end-to-end encryption, not a limitation.
        </P>
      </section>
      <section className="space-y-1.5">
        <H>No warranty</H>
        <P>
          The app is provided &quot;as is&quot;; regular exports are recommended against data
          loss. Users are responsible for unlawful content.
        </P>
      </section>
    </>
  )
}
