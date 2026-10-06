// Registre d'icônes du site vitrine — HugeIcons (free), un mapping sémantique
// unique par usage. Les noms exportés reprennent ceux de Lucide pour faciliter
// la migration : il suffit de changer le chemin d'import dans chaque fichier.
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon, ArrowLeft01Icon, Menu01Icon, Cancel01Icon,
  Mail01Icon, Certificate02Icon, CheckmarkCircle02Icon,
  ChefHatIcon, BeefIcon, Bread02Icon, CakeIcon, CroissantIcon, Coffee02Icon,
  KitchenUtensilsIcon, Hamburger01Icon, Restaurant03Icon,
  Mortarboard01Icon, UserGroupIcon, Building06Icon, TeacherIcon,
  MoneyBag01Icon, SlidersHorizontalIcon, Agreement01Icon,
  DoorOpenIcon, ChartUpIcon, ComputerVideoIcon, LaptopIcon,
  Clock01Icon, ComputerIcon, SentIcon, Loading03Icon, Calendar03Icon,
  Target01Icon, CheckListIcon, TaskDone01Icon, AccessibilityIcon, Note04Icon,
  CallIcon, CalendarCheckIcon, MapPinIcon, ConnectIcon, Store03Icon,
  HeartHandshakeIcon, Award01Icon, BookOpen01Icon, ListViewIcon, BulbIcon,
  ManagerIcon, CleaningBucketIcon, FirstAidKitIcon, GraduationScrollIcon,
  StarIcon, ArrowDown01Icon,
  AiMagicIcon, AiChat01Icon, AiBrain01Icon, AiSecurity01Icon, PlayIcon,
  PauseIcon, FullScreenIcon, Download01Icon, PrinterIcon, RefreshIcon, ArrowUp02Icon,
} from '@hugeicons/core-free-icons'

type P = { className?: string; strokeWidth?: number }
const make = (icon: any) =>
  function I({ className, strokeWidth = 1.8 }: P) {
    return <HugeiconsIcon icon={icon} className={className} strokeWidth={strokeWidth} color="currentColor" />
  }

// ── UI / navigation ──
export const ArrowRight = make(ArrowRight01Icon)
export const ArrowLeft = make(ArrowLeft01Icon)
export const Menu = make(Menu01Icon)
export const X = make(Cancel01Icon)
export const Send = make(SentIcon)
export const Loader2 = make(Loading03Icon)
export const Download = make(Download01Icon)           // modèle à télécharger
export const Printer = make(PrinterIcon)                // document à imprimer
export const Recommencer = make(RefreshIcon)           // nouvelle discussion
export const Envoyer = make(ArrowUp02Icon)             // envoi d'un message

// ── Confiance / éducation ──
export const ShieldCheck = make(Certificate02Icon)     // Qualiopi / certification
export const CheckCircle2 = make(CheckmarkCircle02Icon) // validation / puce
export const GraduationCap = make(Mortarboard01Icon)    // formation / programme
export const Users = make(UserGroupIcon)                // apprenants / équipe
export const UserCheck = make(TeacherIcon)              // formateur praticien
export const Award = make(Award01Icon)                  // exigence / réussite

// ── Financement / business ──
export const Banknote = make(MoneyBag01Icon)            // financement
export const Building2 = make(Building06Icon)           // entreprise / OPCO
export const Briefcase = make(Agreement01Icon)          // dispositif / France Travail
export const TrendingUp = make(ChartUpIcon)             // croissance / plan de compétences
export const DoorOpen = make(DoorOpenIcon)              // ouverture / POEI
export const SlidersHorizontal = make(SlidersHorizontalIcon) // sur-mesure
export const FileCheck2 = make(Note04Icon)              // dossier
export const Store = make(Store03Icon)                  // établissement
export const Network = make(ConnectIcon)                // réseau franchise
export const HeartHandshake = make(HeartHandshakeIcon)  // proximité

// ── E-learning ──
export const MonitorPlay = make(ComputerVideoIcon)      // e-learning
export const Pause = make(PauseIcon)                    // pause du film de présentation
export const PleinEcran = make(FullScreenIcon)          // plein écran du film de présentation
export const Play = make(PlayIcon)                      // lecture du film de présentation
export const Laptop = make(LaptopIcon)                  // plateforme Learnexa
export const Monitor = make(ComputerIcon)               // modalité distanciel

// ── Fiche formation ──
export const Clock = make(Clock01Icon)
export const Calendar = make(Calendar03Icon)
export const CalendarCheck = make(CalendarCheckIcon)
export const Target = make(Target01Icon)                // objectifs
export const ListChecks = make(CheckListIcon)           // compétences
export const ClipboardCheck = make(TaskDone01Icon)      // évaluation
export const Accessibility = make(AccessibilityIcon)
export const BookOpen = make(BookOpen01Icon)            // programme
export const ListView = make(ListViewIcon)              // prérequis
export const Bulb = make(BulbIcon)                      // méthodes

// ── Contact ──
export const Mail = make(Mail01Icon)
export const PhoneCall = make(CallIcon)
/** Logo WhatsApp officiel, plein (les icônes en contour ne le rendent pas reconnaissable). */
export function Whatsapp({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}
export const MapPin = make(MapPinIcon)

// ── Thématiques formation (cartes catégories) ──
export const Management = make(ManagerIcon)
export const Hygiene = make(CleaningBucketIcon)
export const FirstAid = make(FirstAidKitIcon)
export const Formation = make(GraduationScrollIcon)

// ── Métiers de bouche (cartes catégories) ──
export const ChefHat = make(ChefHatIcon)
export const Beef = make(BeefIcon)
export const Wheat = make(Bread02Icon)
export const Cake = make(CakeIcon)
export const Croissant = make(CroissantIcon)
export const Coffee = make(Coffee02Icon)
export const UtensilsCrossed = make(KitchenUtensilsIcon)
export const Sandwich = make(Hamburger01Icon)
export const Wine = make(Restaurant03Icon)
export const Star = make(StarIcon)
export const ChevronDown = make(ArrowDown01Icon)

// ── Starkk / IA ──
export const Sparkles = make(AiMagicIcon)        // réservé aux features IA
export const AiChat = make(AiChat01Icon)         // conversation avec Starkk
export const AiBrain = make(AiBrain01Icon)       // connaissance du dossier
export const AiSecurity = make(AiSecurity01Icon) // garde-fous / confirmation humaine
