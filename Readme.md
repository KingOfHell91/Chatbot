# Projekt: Mein benutzerdefinierter Chatbot

## Über dieses Projekt

Dieses Projekt ist ein benutzerdefinierter Chatbot, der über eine API eines externen Anbieters (z. B. OpenAI) gesteuert wird. Ziel ist es, eine hochspezialisierte und anpassbare KI-Assistenz zu schaffen, die in verschiedene Anwendungen und Workflows integriert werden kann. Die Entwicklung erfolgt mithilfe von Cursor in einer serverseitigen Umgebung.

---

## Besonderheiten und geplante Features

Der Kern dieses Projekts liegt in der Schaffung einer flexiblen und intelligenten Assistenz. Folgende Features sind geplant oder bereits in der Umsetzung:

*   **Dynamische Wissensbasis (Retrieval-Augmented Generation - RAG):** Der Chatbot kann für jede Konversation auf eine Sammlung von Dokumenten (z. B. PDF, TXT, Markdown) zugreifen, die als kontextspezifische Wissensbasis dienen[24]. Dies ermöglicht es ihm, Fragen zu beantworten, die spezifisches Wissen aus diesen Dateien erfordern. Der Prozess umfasst:
    *   **Temporärer Upload:** Dateien werden für die Dauer einer Sitzung bereitgestellt.
    *   **Just-in-Time-Verarbeitung:** Die relevanten Informationen werden bei einer Anfrage aus den Dokumenten extrahiert und zur Generierung der Antwort verwendet[32].

*   **Dynamische Rollen und Persönlichkeiten:** Der Chatbot ist nicht auf eine einzige Persönlichkeit beschränkt. Über das Backend kann ihm je nach Anwendungsfall eine spezifische Rolle (z. B. "Programmier-Assistent", "Kreativ-Autor", "Daten-Analyst") zugewiesen werden. Dies geschieht durch präzise System-Prompts, die sein Verhalten, seinen Ton und seine Wissensbasis steuern.

*   **Tool-Integration (Function Calling):** Um den Chatbot über reine Textgespräche hinaus zu erweitern, soll er die Fähigkeit erhalten, externe Tools und Funktionen aufzurufen. Denkbar sind:
    *   Ausführen von Code-Snippets
    *   Abfragen von Datenbanken
    *   Lesen und Schreiben von Dateien im lokalen System
    *   Interaktion mit anderen APIs

*   **Kontext-Management:** Implementierung eines robusten Systems zur Verwaltung des Gesprächsverlaufs. Dadurch kann der Chatbot auf frühere Teile der Konversation zurückgreifen, was zu kohärenteren und relevanteren Antworten führt.

*   **Modulare Architektur:** Der Code wird so strukturiert, dass der Chatbot-Kern einfach in andere Projekte – wie eine benutzerdefinierte IDE oder ein automatisiertes Skript – als Modul importiert werden kann.

---

## Benutzeroberfläche (UI/UX Design)

Das Design der Anwendung orientiert sich an einem modernen, minimalistischen und hellen Stil, um eine intuitive und ablenkungsfreie Benutzererfahrung zu gewährleisten[44][45].

Die Hauptansicht ist in zwei Bereiche unterteilt:

**1. Linke Seitenleiste (Navigation):**
*   **Projekt-Ordner:** Dient zur Organisation von thematisch zusammengehörigen Konversationen. Jeder Ordner kann mehrere Chats enthalten, ähnlich der "Projects"-Funktion in modernen Chat-Tools[52][53].
*   **Chat-Verlauf:** Innerhalb eines ausgewählten Projekts werden hier alle dazugehörigen Konversationen aufgelistet, um einen schnellen Wechsel zu ermöglichen.

**2. Rechter Hauptbereich (Chat-Fenster):**
*   **Interaktionsbereich:** Hier findet das eigentliche Gespräch mit dem Chatbot statt.
*   **Dateien-Upload:** Eine klar ersichtliche Funktion, um die für den jeweiligen Chat relevanten Dateien als Wissensbasis hochzuladen.

Der Fokus liegt auf einer klaren Struktur und einfacher Bedienbarkeit, sodass der Nutzer sich auf die Interaktion mit dem Chatbot konzentrieren kann[44].

---
