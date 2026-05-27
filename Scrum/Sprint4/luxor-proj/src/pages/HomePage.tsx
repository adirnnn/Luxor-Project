import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { FeaturedPerfumesSection } from "../features/perfumes/FeaturedPerfumesSection";
import { BrandSection } from "../features/brand/BrandSection";
import { CTASection } from "../features/cta/CTASection";
import { motion } from "framer-motion";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const fadeUp: any = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

export default function HomePage() {
  return (
    <MainLayout>
      {/* Hero */}
      <Section className="relative h-screen min-h-[640px] flex items-center justify-center overflow-hidden bg-primary-black p-0">
        {/* Cinematic Backdrop: full screen video background with dark marble texture poster */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-25 mix-blend-color-dodge"
            poster="/images/dark_marble_texture_1779488028451.png"
          >
            <source src="/videos/hero_sand.mp4" type="video/mp4" />
          </video>
          {/* Deep dark radial vignette overlay to center attention */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.9)_100%)] z-10" />
          {/* Subtle dark marble texture overlay */}
          <div 
            className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none z-10"
            style={{ backgroundImage: "url('/images/dark_marble_texture_1779488028451.png')", backgroundSize: 'cover' }}
          />
        </div>

        <Container className="relative z-20 flex flex-col items-center justify-center">
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center text-center gap-12 max-w-5xl"
          >
            <motion.div variants={fadeUp}>
              <H1 className="leading-[0.85] tracking-tight text-primary-champagne text-7xl sm:text-8xl md:text-[10rem] font-heading font-light uppercase">
                El Aroma
                <br />
                <span className="text-primary-gold italic font-light">es Poder.</span>
              </H1>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-12">
              <Text className="max-w-3xl text-primary-champagne/30 text-lg md:text-xl leading-relaxed mx-auto font-light uppercase tracking-[0.2em] italic">
                Nuestra selección de fragancias árabes para quienes entienden que la presencia no se improvisa.
              </Text>
            </motion.div>

            <motion.div variants={fadeUp} className="pt-10">
              <a href="#perfumes">
                <Button className="px-16 py-6 shadow-[0_20px_60px_rgba(224,179,84,0.4)] hover:scale-110 active:scale-95 transition-all font-black uppercase tracking-[0.3em] text-sm">
                  EXPLORAR COLECCIÓN
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </Container>
      </Section>

      {/* Featured Products */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1 }}
      >
        <FeaturedPerfumesSection />
      </motion.div>

      {/* Brand Section */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1 }}
      >
        <BrandSection />
      </motion.div>

      {/* CTA */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1 }}
      >
        <CTASection />
      </motion.div>

    </MainLayout>
  );
}