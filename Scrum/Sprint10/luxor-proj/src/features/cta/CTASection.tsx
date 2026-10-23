import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export const CTASection = () => {
  return (
    <Section size="lg" className="pb-32">
      <Container>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="glass-card p-16 md:p-32 flex flex-col items-center text-center gap-10 max-w-5xl mx-auto bg-gradient-to-br from-primary-gold/10 to-transparent border-primary-gold/10"
        >
          <H2 className="text-4xl md:text-7xl leading-[0.9] text-primary-champagne uppercase font-black tracking-tighter italic">
            encuentra tu <br />
            <span className="text-primary-gold">identidad.</span>
          </H2>

          <Text className="text-primary-champagne/40 text-lg md:text-xl font-medium tracking-[0.1em] uppercase max-w-lg italic">
            Descubre nuestra selección diseñada para dejar una impresión duradera.
          </Text>

          <div className="pt-8">
            <Link to="/perfumes">
              <Button className="px-20 py-6 text-sm font-black tracking-[0.4em] shadow-[0_30px_90px_rgba(212,175,55,0.2)]">
                EXPLORAR COLECCIÓN
              </Button>
            </Link>
          </div>
        </motion.div>
      </Container>
    </Section>
  );
};