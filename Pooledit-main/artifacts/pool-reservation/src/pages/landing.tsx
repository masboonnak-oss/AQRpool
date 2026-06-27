import { FC } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  Dumbbell,
  Globe,
  HeartPulse,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Waves,
  Users,
  UserRound,
  Baby,
  Accessibility,
} from "lucide-react";

const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
const asset = (name: string) => `${baseUrl}/landing-assets/${name}`;

type PublicPackage = {
  id: number;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  imageUrl?: string | null;
  price: number;
  durationDays: number;
  maxBookingsPerMonth: number | null;
  bookingDiscount: number;
};

const getPublicPackages = async (): Promise<PublicPackage[]> => {
  const res = await fetch(`${baseUrl}/api/packages/public`);
  if (!res.ok) return [];
  return res.json();
};

const th = {
  navServices: "บริการ",
  navPackages: "แพ็กเกจ",
  navContact: "ติดต่อ",
  login: "เข้าสู่ระบบ",
  register: "สมัครสมาชิก",
  book: "จองเลย",
  heroTitle: "ศูนย์สุขภาพและสระว่ายน้ำครบวงจรสำหรับทั้งครอบครัว",
  heroSub: "เด็กว่ายน้ำ ผู้ใหญ่ฟิต ผู้สูงวัยฟื้นฟู ดูแลครบจบที่ Aqua Rich บางบอน",
  heroTag: "สระน้ำเกลือ ครูฝึกมืออาชีพ ธาราบำบัด ฟิตเนส และบริการสุขภาพในที่เดียว",
  moreThanPool: "มากกว่าสระว่ายน้ำ",
  moreThanPoolSub: "ออกแบบประสบการณ์ให้ดูง่ายขึ้น เห็นบริการครบขึ้น และพาไปจองได้เร็วขึ้น",
  kids: "เด็ก",
  kidsDesc: "เรียนว่ายน้ำอย่างปลอดภัยกับครูฝึกที่ดูแลใกล้ชิด",
  adults: "วัยทำงาน",
  adultsDesc: "ฟิตเนส คาร์ดิโอ สตูดิโอ และแอโรบิกในน้ำ",
  seniors: "ผู้สูงวัย",
  seniorsDesc: "ธาราบำบัด ฟื้นฟู และดูแลสุขภาพอย่างอ่อนโยน",
  facilities: "บริการเด่น",
  facilitiesSub: "ไอคอนชัด อ่านง่าย และพาคนเข้าใจว่า Aqua Rich มีมากกว่าสระ",
  why: "ทำไมต้อง Aqua Rich",
  packages: "แพ็กเกจสมาชิก",
  packagesSub: "เลือกแพ็กเกจแล้วสมัครสมาชิกเพื่อเริ่มจองบริการได้ทันที",
  noPackages: "สมัครสมาชิกเพื่อดูแพ็กเกจทั้งหมด",
  contact: "มาเจอกันที่บางบอน",
  finalTitle: "พร้อมเริ่มดูแลสุขภาพทั้งบ้านหรือยัง?",
  finalSub: "สมัครสมาชิกวันนี้ แล้วเริ่มจองคอร์สแรกได้ทันที",
};

const en = {
  navServices: "Services",
  navPackages: "Packages",
  navContact: "Contact",
  login: "Log in",
  register: "Sign up",
  book: "Book now",
  heroTitle: "A complete wellness and swimming center for the whole family",
  heroSub: "Kids learn, adults stay fit, seniors recover at Aqua Rich Bangbon.",
  heroTag: "Salt pool, professional coaches, aqua therapy, fitness and wellness services in one place.",
  moreThanPool: "More than a pool",
  moreThanPoolSub: "A clearer, friendlier landing page that shows the full offer and moves visitors to booking.",
  kids: "Kids",
  kidsDesc: "Safe swim lessons with attentive instructors.",
  adults: "Adults",
  adultsDesc: "Fitness, cardio, studio classes and water aerobics.",
  seniors: "Seniors",
  seniorsDesc: "Aqua therapy, recovery and gentle health care.",
  facilities: "Featured services",
  facilitiesSub: "Simple icons and colorful sections make every service easier to scan.",
  why: "Why Aqua Rich",
  packages: "Membership packages",
  packagesSub: "Pick a plan, create an account and start booking right away.",
  noPackages: "Sign up to see all packages",
  contact: "Find us in Bangbon",
  finalTitle: "Ready to care for your whole family?",
  finalSub: "Create an account today and book your first class.",
};

const baht = (n: number) => `฿${Number(n || 0).toLocaleString("th-TH")}`;

export const Landing: FC = () => {
  const { language, setLanguage } = useTranslation();
  const copy = language === "en" ? en : th;
  const isEn = language === "en";
  const { data: packages = [] } = useQuery({
    queryKey: ["public", "packages", "landing-v2"],
    queryFn: getPublicPackages,
    retry: false,
  });

  const ageCards = [
    { title: copy.kids, desc: copy.kidsDesc, icon: Baby, image: asset("kid_ztP_hq.jpg"), tone: "bg-sky-50 text-sky-700 border-sky-100" },
    { title: copy.adults, desc: copy.adultsDesc, icon: Dumbbell, image: asset("fearwater_maxres.jpg"), tone: "bg-amber-50 text-amber-700 border-amber-100" },
    { title: copy.seniors, desc: copy.seniorsDesc, icon: Accessibility, image: asset("eed_mD4_hq.jpg"), tone: "bg-rose-50 text-rose-700 border-rose-100" },
  ];

  const facilities = [
    { label: isEn ? "Heated salt pool" : "สระน้ำเกลือคุมอุณหภูมิ", icon: Waves, tone: "bg-cyan-50 text-cyan-700" },
    { label: isEn ? "Water aerobics" : "แอโรบิกในน้ำ", icon: HeartPulse, tone: "bg-pink-50 text-pink-700" },
    { label: isEn ? "Aqua therapy" : "ธาราบำบัด", icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: isEn ? "Fitness & cardio" : "ฟิตเนสและคาร์ดิโอ", icon: Dumbbell, tone: "bg-amber-50 text-amber-700" },
    { label: isEn ? "Classes & studio" : "สตูดิโอและคลาส", icon: Users, tone: "bg-indigo-50 text-indigo-700" },
    { label: isEn ? "Family membership" : "สมาชิกทั้งครอบครัว", icon: Ticket, tone: "bg-lime-50 text-lime-700" },
  ];

  const reasons = [
    isEn ? "Salt water is gentler on skin and welcoming for every age." : "สระน้ำเกลืออ่อนโยนต่อผิว เหมาะกับทุกวัยในครอบครัว",
    isEn ? "Professional coaches and wellness programs in one place." : "มีครูฝึกและบริการสุขภาพครบในที่เดียว",
    isEn ? "Online booking connects the landing page directly to the member system." : "หน้าเว็บเชื่อมต่อระบบจองจริง สมัครแล้วเริ่มใช้งานต่อได้ทันที",
  ];

  return (
    <div className="min-h-screen bg-[#e8f3fc] text-[#1B3A5B]">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-[#e8f3fc]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <BrandMark size="sm" tagline={false} />
          <div className="ml-auto hidden items-center gap-5 text-sm font-semibold md:flex">
            <a href="#services" className="hover:text-[#2BA9E0]">{copy.navServices}</a>
            <a href="#packages" className="hover:text-[#2BA9E0]">{copy.navPackages}</a>
            <a href="#contact" className="hover:text-[#2BA9E0]">{copy.navContact}</a>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" className="hidden gap-1.5 rounded-lg border-[#cdd9e3] bg-white md:inline-flex" onClick={() => setLanguage(isEn ? "th" : "en")}>
            <Globe className="h-4 w-4" />
            {isEn ? "TH" : "EN"}
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-lg md:inline-flex">
            <Link href="/login">{copy.login}</Link>
          </Button>
          <Button asChild size="sm" className="rounded-lg bg-[#2BA9E0] text-white hover:bg-[#1f93c7]">
            <Link href="/register">{copy.register}</Link>
          </Button>
        </nav>
      </header>

      <section className="relative min-h-[calc(100svh-4.25rem)] overflow-hidden">
        <img src={asset("activity_hero.jpg")} alt="Aqua Rich activity" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#10283f]/65" />
        <div className="relative mx-auto flex min-h-[calc(100svh-4.25rem)] max-w-6xl items-center px-4 py-16">
          <div className="max-w-3xl text-white">
            <div className="inline-flex items-center gap-2 rounded-lg bg-[#F2C200] px-3 py-1.5 text-sm font-bold text-[#1B3A5B]">
              <Sparkles className="h-4 w-4" />
              Aqua Rich Thailand
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">{copy.heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-lg font-medium text-white/90">{copy.heroSub}</p>
            <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">{copy.heroTag}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-lg bg-[#2BA9E0] px-7 text-base font-bold text-white hover:bg-[#1f93c7]">
                <Link href="/book">{copy.book}<CalendarCheck className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" className="h-12 rounded-lg bg-[#F2C200] px-7 text-base font-bold text-[#1B3A5B] hover:bg-[#e3b500]">
                <Link href="/register">{copy.register}<ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2 text-center">
              {[
                [isEn ? "Salt pool" : "สระน้ำเกลือ", Waves],
                [isEn ? "Pro coaches" : "ครูมืออาชีพ", UserRound],
                [isEn ? "Wellness" : "สุขภาพครบวงจร", HeartPulse],
              ].map(([label, Icon]: any) => (
                <div key={label} className="rounded-lg border border-white/25 bg-white/12 px-2 py-3 backdrop-blur">
                  <Icon className="mx-auto h-5 w-5 text-[#F2C200]" />
                  <div className="mt-1 text-xs font-semibold sm:text-sm">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <SectionTitle title={copy.moreThanPool} sub={copy.moreThanPoolSub} icon={Sparkles} />
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {ageCards.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-lg border border-white bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <img src={item.image} alt={item.title} className="h-44 w-full object-cover" />
              <div className="p-5">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${item.tone}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-xl font-bold">{item.title}</h3>
                <p className="mt-1 text-sm text-[#6b7c8f]">{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="services" className="bg-[#d4e8f8] px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <SectionTitle title={copy.facilities} sub={copy.facilitiesSub} icon={Waves} />
          <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {facilities.map((item) => (
              <div key={item.label} className="rounded-lg bg-white p-4 text-center shadow-sm">
                <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-lg ${item.tone}`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="mt-3 text-sm font-bold leading-snug">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <img src={asset("tripcom_1.webp")} alt="Aqua Rich building" className="h-72 w-full rounded-lg object-cover shadow-lg sm:h-96" />
        <div>
          <SectionTitle title={copy.why} icon={ShieldCheck} align="left" />
          <div className="mt-7 space-y-4">
            {reasons.map((reason) => (
              <div key={reason} className="flex gap-3 rounded-lg bg-white p-4 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2BA9E0] text-white">
                  <Check className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-[#31506d] sm:text-base">{reason}</p>
              </div>
            ))}
          </div>
          <Button asChild className="mt-6 rounded-lg bg-[#1B3A5B] text-white hover:bg-[#132c46]">
            <Link href="/register">{copy.register}<ChevronRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <section id="packages" className="bg-[#1B3A5B] px-4 py-14 text-white sm:py-16">
        <div className="mx-auto max-w-6xl">
          <SectionTitle title={copy.packages} sub={copy.packagesSub} icon={Ticket} dark />
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {(packages.length ? packages.slice(0, 3) : fallbackPackages(isEn)).map((pkg: any, index: number) => (
              <article key={pkg.id ?? pkg.name} className="relative overflow-hidden rounded-lg border border-white/15 bg-white/10 p-5">
                {index === 1 && (
                  <div className="mb-3 inline-flex items-center gap-1 rounded-lg bg-[#F2C200] px-2.5 py-1 text-xs font-bold text-[#1B3A5B]">
                    <Star className="h-3.5 w-3.5" />
                    {isEn ? "Popular" : "ยอดนิยม"}
                  </div>
                )}
                {pkg.imageUrl && <img src={pkg.imageUrl} alt={pkg.name} className="-mx-5 -mt-5 mb-5 h-36 w-[calc(100%+2.5rem)] object-cover" />}
                <h3 className="text-xl font-bold">{isEn && pkg.nameEn ? pkg.nameEn : pkg.name}</h3>
                <p className="mt-2 text-3xl font-extrabold text-[#F2C200]">{baht(pkg.price)}</p>
                <p className="mt-2 text-sm text-white/75">{isEn && pkg.descriptionEn ? pkg.descriptionEn : pkg.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/80">
                  <span className="rounded-lg bg-white/10 px-2 py-1">{pkg.durationDays} {isEn ? "days" : "วัน"}</span>
                  {pkg.maxBookingsPerMonth ? <span className="rounded-lg bg-white/10 px-2 py-1">{pkg.maxBookingsPerMonth} {isEn ? "bookings" : "ครั้ง"}</span> : null}
                  {pkg.bookingDiscount > 0 ? <span className="rounded-lg bg-white/10 px-2 py-1">{pkg.bookingDiscount}%</span> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild size="lg" className="rounded-lg bg-[#F2C200] px-7 text-[#1B3A5B] hover:bg-[#e3b500]">
              <Link href="/register">{packages.length ? copy.register : copy.noPackages}<ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#d4e8f8] px-4 py-14 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionTitle title={copy.contact} icon={MapPin} align="left" />
            <div className="mt-6 space-y-3 text-[#31506d]">
              <InfoLine icon={MapPin} text={isEn ? "Bangbon 5 Soi 18 (Petchkasem 81)" : "บางบอน 5 ซอย 18 (เพชรเกษม 81)"} />
              <InfoLine icon={Phone} text="094-978-2542 · LINE @mjc3249s" />
              <InfoLine icon={CalendarCheck} text={isEn ? "Tue-Sun 9:00-19:00, closed Monday" : "อังคาร-อาทิตย์ 9:00-19:00 ปิดวันจันทร์"} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <div className="text-xs font-bold text-[#2BA9E0]">{isEn ? "Floor 1" : "ชั้น 1"}</div>
                <div className="mt-1 text-sm font-semibold">{isEn ? "Pool, therapy, sauna, massage" : "สระ ธาราบำบัด ซาวน่า นวด"}</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <div className="text-xs font-bold text-[#D29D00]">{isEn ? "Floor 2" : "ชั้น 2"}</div>
                <div className="mt-1 text-sm font-semibold">{isEn ? "Fitness, cardio, studio" : "ฟิตเนส คาร์ดิโอ สตูดิโอ"}</div>
              </div>
            </div>
          </div>
          <iframe
            title="Aqua Rich map"
            loading="lazy"
            src="https://maps.google.com/maps?q=Aquarich%20Thailand%20%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%9A%E0%B8%AD%E0%B8%99%205&output=embed"
            className="h-80 w-full rounded-lg border-0 shadow-lg"
          />
        </div>
      </section>

      <section className="bg-[#2BA9E0] px-4 py-14 text-center text-white sm:py-16">
        <h2 className="text-3xl font-extrabold">{copy.finalTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-white/90">{copy.finalSub}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-lg bg-[#F2C200] px-7 text-[#1B3A5B] hover:bg-[#e3b500]">
            <Link href="/register">{copy.register}<ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-lg border-white bg-white/10 px-7 text-white hover:bg-white/20">
            <Link href="/login">{copy.login}</Link>
          </Button>
        </div>
      </section>

      <footer className="bg-[#1B3A5B] px-4 py-7 text-center text-sm text-white/70">
        © Aqua Rich Thailand · บางบอน · 094-978-2542 · LINE @mjc3249s
      </footer>
    </div>
  );
};

const SectionTitle: FC<{ title: string; sub?: string; icon: any; dark?: boolean; align?: "center" | "left" }> = ({ title, sub, icon: Icon, dark = false, align = "center" }) => (
  <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${dark ? "bg-[#F2C200] text-[#1B3A5B]" : "bg-[#2BA9E0] text-white"}`}>
      <Icon className="h-6 w-6" />
    </div>
    <h2 className={`mt-3 text-3xl font-extrabold sm:text-4xl ${dark ? "text-white" : "text-[#1B3A5B]"}`}>{title}</h2>
    {sub && <p className={`mt-2 ${dark ? "text-white/75" : "text-[#6b7c8f]"}`}>{sub}</p>}
  </div>
);

const InfoLine: FC<{ icon: any; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2BA9E0] text-white">
      <Icon className="h-4 w-4" />
    </div>
    <span className="text-sm font-semibold">{text}</span>
  </div>
);

const fallbackPackages = (isEn: boolean) => [
  {
    id: "kids",
    name: isEn ? "Kids course" : "คอร์สเด็ก",
    description: isEn ? "10 swim lessons, 1 hour each." : "10 ครั้ง ครั้งละ 1 ชั่วโมง",
    price: 4500,
    durationDays: 60,
    maxBookingsPerMonth: 10,
    bookingDiscount: 0,
  },
  {
    id: "adult",
    name: isEn ? "Adult course" : "คอร์สผู้ใหญ่",
    description: isEn ? "For confidence, fitness and technique." : "สำหรับความมั่นใจ ฟิตเนส และเทคนิคว่ายน้ำ",
    price: 5500,
    durationDays: 60,
    maxBookingsPerMonth: 10,
    bookingDiscount: 0,
  },
  {
    id: "family",
    name: isEn ? "Family plan" : "แพ็กเกจครอบครัว",
    description: isEn ? "A flexible plan for families." : "แพ็กเกจยืดหยุ่นสำหรับทั้งครอบครัว",
    price: 9000,
    durationDays: 90,
    maxBookingsPerMonth: 20,
    bookingDiscount: 5,
  },
];
