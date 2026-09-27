import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { motion } from "framer-motion";

export const BrandSection = () => {
  return (
    <Section size="lg" id="brand" className="pt-24 md:pt-32">
      <Container>
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="glass-card p-12 md:p-24 flex flex-col items-center text-center gap-12 max-w-5xl mx-auto border-white/5"
        >
          <div className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.5em] uppercase text-primary-gold font-black">Filosofía</span>
            <H2 className="text-4xl md:text-6xl leading-tight text-primary-champagne italic uppercase font-black tracking-tighter">
              Elegir bien no es casualidad.
            </H2>
          </div>

          <div className="w-20 h-px bg-primary-gold/30" />

          <div className="max-w-2xl flex flex-col gap-10">
            <Text className="text-lg md:text-2xl text-primary-champagne/60 leading-relaxed font-medium italic">
              Cada fragancia es una selección con criterio, experiencia y una visión clara:
              proyectar presencia sin decir una palabra.
            </Text>

            <Text className="text-lg md:text-2xl text-primary-champagne/60 leading-relaxed font-medium italic">
              Habibi Parfums no sigue tendencias.
              Define estándares para quienes entienden que el aroma también es identidad.
            </Text>
          </div>
        </motion.div>
      </Container>
    </Section>
  );
};