/**
 * Icônes du CRM — design system Lab Learning.
 * Hugeicons (Stroke Rounded, trait 1,5 px) avec les MÊMES noms que Lucide :
 * la migration d'un fichier = changer l'import, rien d'autre.
 * Chaque correspondance est vérifiée contre les exports du paquet.
 */
import * as React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AgreementIcon,
  Alert02Icon,
  AlertCircleIcon,
  Archive02Icon,
  ArrowDown01Icon,
  ArrowDown02Icon,
  ArrowLeft01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  ArrowUp02Icon,
  ArrowUpRight01Icon,
  Attachment01Icon,
  Award01Icon,
  BankIcon,
  BanknoteIcon,
  BirthdayCakeIcon,
  BookOpen01Icon,
  Briefcase01Icon,
  BubbleChatNotificationIcon,
  Building02Icon,
  Building03Icon,
  Calculator01Icon,
  Calendar03Icon,
  Calendar04Icon,
  CalendarCheckIn01Icon,
  CalendarSetting01Icon,
  Call02Icon,
  CallOutgoing01Icon,
  Camera01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ChartColumnIcon,
  CheckListIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle01Icon,
  CheckmarkCircle02Icon,
  CheckmarkSquare02Icon,
  ChefHatIcon,
  CircleIcon,
  ClipboardIcon,
  Clock01Icon,
  Clock04Icon,
  Coffee02Icon,
  CompassIcon,
  ComputerIcon,
  ComputerPhoneSyncIcon,
  ConstructionIcon,
  Copy01Icon,
  CreditCardIcon,
  CroissantIcon,
  DashboardSquare01Icon,
  Database01Icon,
  DateTimeIcon,
  Delete02Icon,
  Download01Icon,
  Edit01Icon,
  Edit02Icon,
  Eraser01Icon,
  EuroCircleIcon,
  EuroIcon,
  File01Icon,
  FileAddIcon,
  FileDownloadIcon,
  FileEditIcon,
  FileQuestionMarkIcon,
  FileRemoveIcon,
  FileUnknownIcon,
  FileUploadIcon,
  FileVerifiedIcon,
  Files01Icon,
  FilterIcon,
  Fire02Icon,
  FlashIcon,
  FloppyDiskIcon,
  Folder01Icon,
  FolderAddIcon,
  FolderCheckIcon,
  FolderDetailsIcon,
  FolderOpenIcon,
  Globe02Icon,
  GridIcon,
  GridViewIcon,
  HealthIcon,
  HelpCircleIcon,
  Home01Icon,
  Idea01Icon,
  Image01Icon,
  ImageAdd01Icon,
  InformationCircleIcon,
  Invoice01Icon,
  Invoice02Icon,
  Invoice03Icon,
  Key01Icon,
  Layers01Icon,
  LayoutThreeColumnIcon,
  LeftToRightListBulletIcon,
  Legal01Icon,
  Link01Icon,
  LinkSquare01Icon,
  Loading03Icon,
  Location01Icon,
  Login01Icon,
  Logout01Icon,
  Mail01Icon,
  MailOpen01Icon,
  MailboxIcon,
  MapsIcon,
  Menu01Icon,
  Message01Icon,
  Message02Icon,
  Mic01Icon,
  MinusSignCircleIcon,
  MinusSignIcon,
  MoreHorizontalIcon,
  Mortarboard01Icon,
  Notification03Icon,
  OfficeIcon,
  Passport01Icon,
  PenTool03Icon,
  PencilEdit01Icon,
  PencilEdit02Icon,
  PercentIcon,
  PieChartIcon,
  PlayIcon,
  PresentationBarChart01Icon,
  PrinterIcon,
  QrCodeIcon,
  QuoteDownIcon,
  RecordIcon,
  RefreshIcon,
  RepeatIcon,
  Restaurant01Icon,
  RestaurantIcon,
  Rocket01Icon,
  RotateLeft01Icon,
  Route01Icon,
  Search01Icon,
  SecurityCheckIcon,
  SentIcon,
  Settings01Icon,
  Settings02Icon,
  Share01Icon,
  Shield01Icon,
  ShieldAlertIcon,
  ShieldUserIcon,
  ShoppingCart01Icon,
  SidebarLeft01Icon,
  SidebarLeftIcon,
  SnowIcon,
  SparklesIcon,
  SquareIcon,
  SquareLock02Icon,
  StarIcon,
  SteakIcon,
  StickyNote02Icon,
  Store01Icon,
  Table01Icon,
  Tag01Icon,
  Target02Icon,
  TaskDaily01Icon,
  TaskDone01Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Tick02Icon,
  TimerIcon,
  TradeUpIcon,
  UnavailableIcon,
  UnfoldMoreIcon,
  Unlink01Icon,
  Upload01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  UserMinus01Icon,
  UserRemove01Icon,
  UserSettings01Icon,
  Video01Icon,
  ViewIcon,
  ViewOffIcon,
  Wallet01Icon,
  WebhookIcon,
  WheelchairIcon,
  WrenchIcon,
  Facebook01Icon,
  InstagramIcon,
  GoogleIcon,
  MetaIcon,
  WhatsappIcon,
  Megaphone01Icon,
} from '@hugeicons/core-free-icons'

export type LucideIcon = React.ComponentType<{
  className?: string
  size?: number | string
  strokeWidth?: number | string
  color?: string
  fill?: string
  [prop: string]: any
}>

/** Enveloppe : icône Hugeicons avec l'API d'une icône Lucide (className, size). */
function hugeify(icone: any): LucideIcon {
  const Comp = ({ className, size = 24, strokeWidth = 1.5, color = 'currentColor', ...rest }: any) => (
    <HugeiconsIcon icon={icone} className={className} size={size} strokeWidth={strokeWidth} color={color} {...rest} />
  )
  return Comp
}

export const Accessibility = hugeify(WheelchairIcon)
export const AlertCircle = hugeify(AlertCircleIcon)
export const AlertTriangle = hugeify(Alert02Icon)
export const Archive = hugeify(Archive02Icon)
export const ArrowDown = hugeify(ArrowDown02Icon)
export const ArrowLeft = hugeify(ArrowLeft02Icon)
export const ArrowRight = hugeify(ArrowRight02Icon)
export const ArrowUp = hugeify(ArrowUp02Icon)
export const ArrowUpRight = hugeify(ArrowUpRight01Icon)
export const Award = hugeify(Award01Icon)
export const BadgeCheck = hugeify(CheckmarkBadge01Icon)
export const BadgeEuro = hugeify(EuroCircleIcon)
export const Ban = hugeify(UnavailableIcon)
export const Banknote = hugeify(BanknoteIcon)
export const BarChart3 = hugeify(ChartColumnIcon)
export const Beef = hugeify(SteakIcon)
export const Bell = hugeify(Notification03Icon)
export const BookOpen = hugeify(BookOpen01Icon)
export const Briefcase = hugeify(Briefcase01Icon)
export const Building = hugeify(Building02Icon)
export const Building2 = hugeify(Building03Icon)
export const Cake = hugeify(BirthdayCakeIcon)
export const Calculator = hugeify(Calculator01Icon)
export const Calendar = hugeify(Calendar03Icon)
export const CalendarCheck = hugeify(CalendarCheckIn01Icon)
export const CalendarClock = hugeify(CalendarSetting01Icon)
export const CalendarDays = hugeify(Calendar04Icon)
export const CalendarRange = hugeify(DateTimeIcon)
export const Camera = hugeify(Camera01Icon)
export const Check = hugeify(Tick02Icon)
export const CheckCircle = hugeify(CheckmarkCircle01Icon)
export const CheckCircle2 = hugeify(CheckmarkCircle02Icon)
export const CheckSquare = hugeify(CheckmarkSquare02Icon)
export const ChefHat = hugeify(ChefHatIcon)
export const ChevronDown = hugeify(ArrowDown01Icon)
export const ChevronLeft = hugeify(ArrowLeft01Icon)
export const ChevronRight = hugeify(ArrowRight01Icon)
export const ChevronUp = hugeify(ArrowUp01Icon)
export const ChevronsUpDown = hugeify(UnfoldMoreIcon)
export const Circle = hugeify(CircleIcon)
export const CircleCheck = hugeify(CheckmarkCircle01Icon)
export const CircleDot = hugeify(RecordIcon)
export const CircleUserRound = hugeify(UserCircleIcon)
export const Clipboard = hugeify(ClipboardIcon)
export const ClipboardCheck = hugeify(TaskDone01Icon)
export const ClipboardList = hugeify(TaskDaily01Icon)
export const ClipboardPaste = hugeify(ClipboardIcon)
export const Clock = hugeify(Clock01Icon)
export const Coffee = hugeify(Coffee02Icon)
export const Columns3 = hugeify(LayoutThreeColumnIcon)
export const Compass = hugeify(CompassIcon)
export const Construction = hugeify(ConstructionIcon)
export const Copy = hugeify(Copy01Icon)
export const CreditCard = hugeify(CreditCardIcon)
export const Croissant = hugeify(CroissantIcon)
export const Database = hugeify(Database01Icon)
export const Download = hugeify(Download01Icon)
export const Edit3 = hugeify(Edit01Icon)
export const Eraser = hugeify(Eraser01Icon)
export const Euro = hugeify(EuroIcon)
export const ExternalLink = hugeify(LinkSquare01Icon)
export const Eye = hugeify(ViewIcon)
export const EyeOff = hugeify(ViewOffIcon)
export const FileCheck = hugeify(FileVerifiedIcon)
export const FileCheck2 = hugeify(FileVerifiedIcon)
export const FileDown = hugeify(FileDownloadIcon)
export const FilePen = hugeify(FileEditIcon)
export const FilePenLine = hugeify(FileEditIcon)
export const FilePlus = hugeify(FileAddIcon)
export const FilePlus2 = hugeify(FileAddIcon)
export const FileQuestion = hugeify(FileQuestionMarkIcon)
export const FileSignature = hugeify(FileEditIcon)
export const FileStack = hugeify(Files01Icon)
export const FileText = hugeify(File01Icon)
export const FileUp = hugeify(FileUploadIcon)
export const FileWarning = hugeify(FileUnknownIcon)
export const FileX = hugeify(FileRemoveIcon)
export const Files = hugeify(Files01Icon)
export const Filter = hugeify(FilterIcon)
export const Flame = hugeify(Fire02Icon)
export const Folder = hugeify(Folder01Icon)
export const FolderCheck = hugeify(FolderCheckIcon)
export const FolderOpen = hugeify(FolderOpenIcon)
export const FolderPlus = hugeify(FolderAddIcon)
export const FolderTree = hugeify(FolderDetailsIcon)
export const Globe = hugeify(Globe02Icon)
export const GraduationCap = hugeify(Mortarboard01Icon)
export const Handshake = hugeify(AgreementIcon)
export const Hash = hugeify(GridIcon)
export const HeartPulse = hugeify(HealthIcon)
export const HelpCircle = hugeify(HelpCircleIcon)
export const History = hugeify(Clock04Icon)
export const Home = hugeify(Home01Icon)
export const IdCard = hugeify(Passport01Icon)
export const Image = hugeify(Image01Icon)
export const ImagePlus = hugeify(ImageAdd01Icon)
export const Info = hugeify(InformationCircleIcon)
export const KeyRound = hugeify(Key01Icon)
export const Landmark = hugeify(BankIcon)
export const Layers = hugeify(Layers01Icon)
export const LayoutDashboard = hugeify(DashboardSquare01Icon)
export const LayoutGrid = hugeify(GridViewIcon)
export const LifeBuoy = hugeify(HelpCircleIcon)
export const Lightbulb = hugeify(Idea01Icon)
export const Link = hugeify(Link01Icon)
export const Link2 = hugeify(Link01Icon)
export const List = hugeify(LeftToRightListBulletIcon)
export const ListChecks = hugeify(CheckListIcon)
export const Loader2 = hugeify(Loading03Icon)
export const Lock = hugeify(SquareLock02Icon)
export const LogIn = hugeify(Login01Icon)
export const LogOut = hugeify(Logout01Icon)
export const Mail = hugeify(Mail01Icon)
export const MailOpen = hugeify(MailOpen01Icon)
export const Mails = hugeify(MailboxIcon)
export const Map = hugeify(MapsIcon)
export const MapPin = hugeify(Location01Icon)
export const Menu = hugeify(Menu01Icon)
export const MessageCircle = hugeify(Message02Icon)
export const MessageSquare = hugeify(Message01Icon)
export const MessageSquareWarning = hugeify(BubbleChatNotificationIcon)
export const Mic = hugeify(Mic01Icon)
export const Minus = hugeify(MinusSignIcon)
export const MinusCircle = hugeify(MinusSignCircleIcon)
export const Monitor = hugeify(ComputerIcon)
export const MonitorSmartphone = hugeify(ComputerPhoneSyncIcon)
export const MoreHorizontal = hugeify(MoreHorizontalIcon)
export const Network = hugeify(Share01Icon)
export const PanelLeft = hugeify(SidebarLeft01Icon)
export const PanelLeftClose = hugeify(SidebarLeftIcon)
export const Paperclip = hugeify(Attachment01Icon)
export const Pen = hugeify(Edit02Icon)
export const PenLine = hugeify(PencilEdit01Icon)
export const PenTool = hugeify(PenTool03Icon)
export const Pencil = hugeify(PencilEdit02Icon)
export const Percent = hugeify(PercentIcon)
export const Phone = hugeify(Call02Icon)
export const PhoneCall = hugeify(CallOutgoing01Icon)
export const PieChart = hugeify(PieChartIcon)
export const Play = hugeify(PlayIcon)
export const Plus = hugeify(Add01Icon)
export const Presentation = hugeify(PresentationBarChart01Icon)
export const Printer = hugeify(PrinterIcon)
export const QrCode = hugeify(QrCodeIcon)
export const Quote = hugeify(QuoteDownIcon)
export const Receipt = hugeify(Invoice01Icon)
export const ReceiptEuro = hugeify(Invoice03Icon)
export const ReceiptText = hugeify(Invoice02Icon)
export const RefreshCw = hugeify(RefreshIcon)
export const Repeat = hugeify(RepeatIcon)
export const Rocket = hugeify(Rocket01Icon)
export const RotateCcw = hugeify(RotateLeft01Icon)
export const Route = hugeify(Route01Icon)
export const Save = hugeify(FloppyDiskIcon)
export const Scale = hugeify(Legal01Icon)
export const Search = hugeify(Search01Icon)
export const Send = hugeify(SentIcon)
export const Settings = hugeify(Settings01Icon)
export const Settings2 = hugeify(Settings02Icon)
export const Shield = hugeify(Shield01Icon)
export const ShieldAlert = hugeify(ShieldAlertIcon)
export const ShieldCheck = hugeify(SecurityCheckIcon)
export const ShieldOff = hugeify(ShieldUserIcon)
export const ShoppingCart = hugeify(ShoppingCart01Icon)
export const Snowflake = hugeify(SnowIcon)
export const Sparkles = hugeify(SparklesIcon)
export const Square = hugeify(SquareIcon)
export const Stamp = hugeify(OfficeIcon)
export const Star = hugeify(StarIcon)
export const StickyNote = hugeify(StickyNote02Icon)
export const Store = hugeify(Store01Icon)
export const Table2 = hugeify(Table01Icon)
export const Tag = hugeify(Tag01Icon)
export const Target = hugeify(Target02Icon)
export const ThumbsDown = hugeify(ThumbsDownIcon)
export const ThumbsUp = hugeify(ThumbsUpIcon)
export const Timer = hugeify(TimerIcon)
export const Trash2 = hugeify(Delete02Icon)
export const TrendingUp = hugeify(TradeUpIcon)
export const Unlink = hugeify(Unlink01Icon)
export const Upload = hugeify(Upload01Icon)
export const User = hugeify(UserIcon)
export const UserCheck = hugeify(UserCheck01Icon)
export const UserCircle = hugeify(UserCircleIcon)
export const UserCog = hugeify(UserSettings01Icon)
export const UserMinus = hugeify(UserMinus01Icon)
export const UserPlus = hugeify(UserAdd01Icon)
export const UserRound = hugeify(UserIcon)
export const UserX = hugeify(UserRemove01Icon)
export const Users = hugeify(UserGroupIcon)
export const Utensils = hugeify(Restaurant01Icon)
export const UtensilsCrossed = hugeify(RestaurantIcon)
export const Video = hugeify(Video01Icon)
export const Wallet = hugeify(Wallet01Icon)
export const Webhook = hugeify(WebhookIcon)
export const Wrench = hugeify(WrenchIcon)
export const X = hugeify(Cancel01Icon)
export const XCircle = hugeify(CancelCircleIcon)
export const Zap = hugeify(FlashIcon)

// Canaux de prospects et messageries : logos des marques (page Leads, canaux, campagnes)
export const Meta = hugeify(MetaIcon)
export const Facebook = hugeify(Facebook01Icon)
export const Instagram = hugeify(InstagramIcon)
export const Google = hugeify(GoogleIcon)
export const Whatsapp = hugeify(WhatsappIcon)
export const Megaphone = hugeify(Megaphone01Icon)
