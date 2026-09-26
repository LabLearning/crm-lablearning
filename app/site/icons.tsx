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
