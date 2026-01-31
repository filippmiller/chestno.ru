"""
AI Response Generation Service for Reviews.

This module provides rule-based AI response generation for business reviews.
It analyzes review sentiment and topics to generate appropriate Russian language responses.

No external AI APIs are required - this uses template-based generation with keyword matching.
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any


class Sentiment(str, Enum):
    """Review sentiment classification."""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class ResponseTone(str, Enum):
    """Response tone variants."""
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    APOLOGETIC = "apologetic"


@dataclass
class TopicMatch:
    """Represents a detected topic in the review."""
    topic: str
    display_name: str
    keywords: list[str]


@dataclass
class AIResponseSuggestion:
    """A single AI-generated response suggestion."""
    tone: ResponseTone
    text: str
    confidence: float  # 0.0 - 1.0


@dataclass
class AIResponseResult:
    """Result of AI response generation."""
    sentiment: Sentiment
    topics: list[str]
    suggestions: list[AIResponseSuggestion]


# Topic detection keywords (Russian)
TOPIC_KEYWORDS: dict[str, TopicMatch] = {
    "quality": TopicMatch(
        topic="quality",
        display_name="Качество продукции",
        keywords=["качество", "качественн", "брак", "дефект", "хорош", "плох", "отличн", "ужасн"]
    ),
    "service": TopicMatch(
        topic="service",
        display_name="Обслуживание",
        keywords=["обслуживание", "сервис", "персонал", "сотрудник", "менеджер", "консультант", "вежлив", "грубо", "помогли", "не помогли"]
    ),
    "delivery": TopicMatch(
        topic="delivery",
        display_name="Доставка",
        keywords=["доставк", "привезли", "курьер", "опоздали", "вовремя", "быстр", "долго ждал"]
    ),
    "price": TopicMatch(
        topic="price",
        display_name="Цена",
        keywords=["цен", "дорого", "дешево", "стоимость", "переплат", "выгодн", "скидк"]
    ),
    "packaging": TopicMatch(
        topic="packaging",
        display_name="Упаковка",
        keywords=["упаковк", "упакован", "повреждён", "помят", "целост"]
    ),
    "freshness": TopicMatch(
        topic="freshness",
        display_name="Свежесть",
        keywords=["свеж", "просрочен", "срок годности", "испортил", "несвеж"]
    ),
    "assortment": TopicMatch(
        topic="assortment",
        display_name="Ассортимент",
        keywords=["ассортимент", "выбор", "разнообраз", "наличи", "нет в наличии"]
    ),
    "recommendation": TopicMatch(
        topic="recommendation",
        display_name="Рекомендация",
        keywords=["рекоменду", "советую", "не советую", "буду заказывать", "вернусь"]
    ),
}

# Positive keywords for sentiment detection
POSITIVE_KEYWORDS = [
    "отлично", "прекрасно", "замечательно", "великолепно", "супер", "класс",
    "рекомендую", "советую", "понравил", "доволен", "довольна", "благодар",
    "спасибо", "лучший", "лучшая", "качественн", "быстро", "вежлив",
    "профессионал", "вернусь", "буду заказывать", "рад", "рада", "хорош"
]

# Negative keywords for sentiment detection
NEGATIVE_KEYWORDS = [
    "ужасно", "кошмар", "отвратительно", "плохо", "разочарован", "недоволен",
    "недовольна", "брак", "дефект", "сломан", "испорчен", "просрочен",
    "грубо", "хамство", "обман", "мошенник", "не рекомендую", "не советую",
    "жалоба", "возврат", "претензия", "ужас", "никогда", "больше не"
]


# Response templates by sentiment and tone
RESPONSE_TEMPLATES: dict[Sentiment, dict[ResponseTone, list[str]]] = {
    Sentiment.POSITIVE: {
        ResponseTone.PROFESSIONAL: [
            "Благодарим вас за положительный отзыв! Мы рады, что вы остались довольны {topic_phrase}. Ваше мнение очень важно для нас, и мы продолжим работать над качеством наших услуг.",
            "Спасибо за высокую оценку нашей работы! Мы ценим ваше доверие и приложим все усилия, чтобы и в дальнейшем оправдывать ваши ожидания.",
            "Благодарим за отзыв! Приятно знать, что наша работа приносит положительные эмоции. Будем рады видеть вас снова!"
        ],
        ResponseTone.FRIENDLY: [
            "Спасибо большое за тёплые слова! Мы очень рады, что вам понравилось {topic_phrase}. Ждём вас снова!",
            "Как приятно читать такие отзывы! Спасибо, что поделились своими впечатлениями. До новых встреч!",
            "Благодарим за чудесный отзыв! Ваши слова вдохновляют нас становиться ещё лучше. Всегда рады вам!"
        ],
    },
    Sentiment.NEUTRAL: {
        ResponseTone.PROFESSIONAL: [
            "Благодарим вас за отзыв. Мы ценим вашу обратную связь и учтём ваши замечания в дальнейшей работе. Если у вас есть дополнительные пожелания, мы будем рады их услышать.",
            "Спасибо за ваш отзыв. Мы постоянно работаем над улучшением качества наших услуг. Ваше мнение поможет нам стать лучше.",
            "Благодарим за обратную связь. Мы внимательно изучим ваш отзыв и примем меры для улучшения нашей работы."
        ],
        ResponseTone.FRIENDLY: [
            "Спасибо, что нашли время оставить отзыв! Мы всегда открыты к предложениям и будем рады услышать, как можем стать лучше для вас.",
            "Благодарим за честный отзыв! Мы учтём ваши пожелания. Надеемся, что следующий ваш опыт будет ещё лучше!",
            "Спасибо за отзыв! Ваше мнение важно для нас. Будем стараться превзойти ваши ожидания в следующий раз!"
        ],
    },
    Sentiment.NEGATIVE: {
        ResponseTone.PROFESSIONAL: [
            "Благодарим вас за обратную связь. Нам очень жаль, что ваш опыт оказался неудовлетворительным. Мы уже начали разбираться в ситуации {topic_phrase}. Пожалуйста, свяжитесь с нами для решения вопроса.",
            "Приносим искренние извинения за доставленные неудобства. Описанная вами ситуация неприемлема для нашей компании. Мы примем все необходимые меры для исправления ситуации.",
            "Благодарим за отзыв, хотя нам очень жаль, что он оказался негативным. Мы серьёзно относимся к подобным случаям и обязательно проведём внутреннее расследование."
        ],
        ResponseTone.APOLOGETIC: [
            "Приносим наши искренние извинения за возникшую ситуацию. Мы понимаем ваше разочарование и готовы сделать всё возможное для исправления ситуации. Пожалуйста, свяжитесь с нами — мы обязательно найдём решение.",
            "Нам очень жаль, что ваш опыт был негативным. Приносим глубокие извинения за доставленные неудобства. Мы уже работаем над устранением проблемы и хотели бы компенсировать вам неудобства.",
            "Искренне сожалеем о произошедшем. Это не тот уровень сервиса, который мы стремимся предоставлять. Пожалуйста, дайте нам возможность всё исправить — свяжитесь с нами любым удобным способом."
        ],
        ResponseTone.FRIENDLY: [
            "Очень жаль, что так получилось. Мы хотим разобраться в ситуации и всё исправить. Пожалуйста, напишите нам — мы обязательно поможем!",
            "Нам искренне жаль, что вы столкнулись с такой проблемой. Давайте вместе найдём решение! Свяжитесь с нами — мы всё исправим.",
            "Ох, как нехорошо получилось! Приносим извинения и очень хотим всё исправить. Напишите нам, пожалуйста!"
        ],
    },
}


def _normalize_text(text: str) -> str:
    """Normalize text for keyword matching."""
    return text.lower().strip()


def analyze_sentiment(rating: int, review_text: str) -> Sentiment:
    """
    Analyze review sentiment based on rating and text content.

    Args:
        rating: Review rating (1-5)
        review_text: Review body text

    Returns:
        Detected sentiment
    """
    normalized_text = _normalize_text(review_text)

    # Count positive and negative keyword matches
    positive_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in normalized_text)
    negative_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in normalized_text)

    # Rating-based baseline
    if rating >= 4:
        base_sentiment = Sentiment.POSITIVE
    elif rating <= 2:
        base_sentiment = Sentiment.NEGATIVE
    else:
        base_sentiment = Sentiment.NEUTRAL

    # Adjust based on text analysis
    keyword_diff = positive_count - negative_count

    if base_sentiment == Sentiment.POSITIVE and negative_count > positive_count + 2:
        return Sentiment.NEUTRAL
    elif base_sentiment == Sentiment.NEGATIVE and positive_count > negative_count + 2:
        return Sentiment.NEUTRAL
    elif base_sentiment == Sentiment.NEUTRAL:
        if keyword_diff >= 3:
            return Sentiment.POSITIVE
        elif keyword_diff <= -3:
            return Sentiment.NEGATIVE

    return base_sentiment


def extract_topics(review_text: str) -> list[str]:
    """
    Extract discussed topics from review text.

    Args:
        review_text: Review body text

    Returns:
        List of detected topic display names
    """
    normalized_text = _normalize_text(review_text)
    detected_topics: list[str] = []

    for topic_match in TOPIC_KEYWORDS.values():
        for keyword in topic_match.keywords:
            if keyword in normalized_text:
                if topic_match.display_name not in detected_topics:
                    detected_topics.append(topic_match.display_name)
                break

    return detected_topics


def _format_topic_phrase(topics: list[str], sentiment: Sentiment) -> str:
    """Format topics into a natural phrase for response templates."""
    if not topics:
        if sentiment == Sentiment.NEGATIVE:
            return "и примем меры"
        return ""

    if len(topics) == 1:
        topic = topics[0].lower()
        if sentiment == Sentiment.NEGATIVE:
            return f"в вопросе с {topic}м" if not topic.endswith("а") else f"в вопросе с {topic}й"
        return topic

    # Multiple topics
    if sentiment == Sentiment.NEGATIVE:
        return "и проверим все аспекты"
    return " и ".join(topics[:2]).lower()


def generate_ai_responses(
    review_id: str,
    rating: int,
    title: str | None,
    body: str,
) -> AIResponseResult:
    """
    Generate AI response suggestions for a review.

    Args:
        review_id: Review UUID (for potential future use)
        rating: Review rating (1-5)
        title: Review title (optional)
        body: Review body text

    Returns:
        AIResponseResult with sentiment, topics, and response suggestions
    """
    # Combine title and body for analysis
    full_text = f"{title or ''} {body}".strip()

    # Analyze sentiment and extract topics
    sentiment = analyze_sentiment(rating, full_text)
    topics = extract_topics(full_text)

    # Generate topic phrase for templates
    topic_phrase = _format_topic_phrase(topics, sentiment)

    # Get appropriate templates based on sentiment
    templates = RESPONSE_TEMPLATES[sentiment]

    suggestions: list[AIResponseSuggestion] = []

    # Generate responses for each applicable tone
    if sentiment == Sentiment.POSITIVE:
        # For positive: professional and friendly
        tones = [ResponseTone.PROFESSIONAL, ResponseTone.FRIENDLY]
    elif sentiment == Sentiment.NEGATIVE:
        # For negative: apologetic, professional, and friendly
        tones = [ResponseTone.APOLOGETIC, ResponseTone.PROFESSIONAL, ResponseTone.FRIENDLY]
    else:
        # For neutral: professional and friendly
        tones = [ResponseTone.PROFESSIONAL, ResponseTone.FRIENDLY]

    for tone in tones:
        if tone in templates:
            # Select first template for this tone
            template = templates[tone][0]

            # Format the response
            response_text = template.format(topic_phrase=topic_phrase)

            # Clean up any empty placeholders
            response_text = re.sub(r'\s+', ' ', response_text).strip()
            response_text = response_text.replace("  ", " ")

            # Calculate confidence based on keyword matches
            confidence = 0.85 if topics else 0.75
            if sentiment == Sentiment.POSITIVE and rating >= 4:
                confidence = 0.9
            elif sentiment == Sentiment.NEGATIVE and rating <= 2:
                confidence = 0.9

            suggestions.append(AIResponseSuggestion(
                tone=tone,
                text=response_text,
                confidence=confidence,
            ))

    return AIResponseResult(
        sentiment=sentiment,
        topics=topics,
        suggestions=suggestions,
    )


def get_ai_response_for_review(review: dict[str, Any]) -> dict[str, Any]:
    """
    Service function to generate AI responses for a review dict.

    Args:
        review: Review dict with id, rating, title, body fields

    Returns:
        Dict with sentiment, topics, and suggestions
    """
    result = generate_ai_responses(
        review_id=str(review.get("id", "")),
        rating=review.get("rating", 3),
        title=review.get("title"),
        body=review.get("body", ""),
    )

    return {
        "sentiment": result.sentiment.value,
        "topics": result.topics,
        "suggestions": [
            {
                "tone": s.tone.value,
                "text": s.text,
                "confidence": s.confidence,
            }
            for s in result.suggestions
        ],
    }
