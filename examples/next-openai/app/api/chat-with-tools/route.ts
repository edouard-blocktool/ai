import {
  OpenAIStream,
  StreamingTextResponse,
  Tool,
  ToolCallPayload,
  experimental_StreamData,
} from 'ai';
import OpenAI from 'openai';
import { Stream } from 'openai/streaming';

// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: 'Get the current weather',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          format: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description:
              'The temperature unit to use. Infer this from the users location.',
          },
        },
        required: ['location', 'format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eval_code_in_browser',
      description: 'Execute javascript code in the browser with eval().',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: `Javascript code that will be directly executed via eval(). Do not use backticks in your response.
           DO NOT include any newlines in your response, and be sure to provide only valid JSON when providing the arguments object.
           The output of the eval() will be returned directly by the function.`,
          },
        },
        required: ['code'],
      },
    },
  },
];

export async function POST(req: Request) {
  const { messages } = await req.json();

  const model = 'gpt-4-1106-preview';

  const WITH_THIS_QUESTION_STREAMING_OF_TOOL_CALL_WORKS = "What was $MSFT revenue in Q1 2022?";
  const WITH_THIS_QUESTION_STREAMING_OF_TOOL_CALL_DOES_NOT_WORK = "Compare $MSFT revenue in Q1 2022 and Q1 2023?";

  const params: any = {
    "model": "gpt-4-1106-preview",
    "messages": [
      {
        "content": "You are a professional financial analyst.\n\nCurrent date: 2024-01-31",
        "role": "system"
      },
      {
        "content": WITH_THIS_QUESTION_STREAMING_OF_TOOL_CALL_DOES_NOT_WORK,
        "role": "user"
      }
    ],
    "temperature": 0.3,
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_filing",
          "parameters": {
            "type": "object",
            "properties": {
              "document_type": {
                "type": "string",
                "description": "SEC form type. For example \"10-K\", \"10-Q\", ..."
              },
              "section": {
                "type": "string",
                "description": "SEC form subsection like \"Item 1. Business\", \"Item 1A. Risk Factors\", ..."
              },
              "ticker": {
                "type": "string",
                "description": "Stock ticker to filter by."
              },
              "query": {
                "type": "string",
                "description": "Search query."
              },
              "keywords": {
                "type": "array",
                "description": "List of keywords that are likely to appear in the SEC form close to the answer.",
                "items": {
                  "type": "string"
                }
              },
              "period": {
                "type": "object",
                "description": "Specify the period for the financial document. Either choose latest or specify fiscal_year and fiscal_quarter.",
                "properties": {
                  "latest": {
                    "type": "boolean",
                    "description": "If true, only search in the most recent document. This option is mutually exclusive with fiscal_year and fiscal_quarter."
                  },
                  "fiscal_year": {
                    "type": "integer",
                    "description": "Fiscal year of the document."
                  },
                  "fiscal_quarter": {
                    "type": "integer",
                    "description": "Fiscal quarter of the document (1-4). Use this in combination with fiscal_year when the user asks for a specific quarter."
                  }
                }
              }
            },
            "required": [
              "keywords"
            ]
          },
          "description": "Perform a full text search on SEC documents of publicly traded companies. The function returns up to 5 results."
        }
      },
    ],
    "max_tokens": 1000,
    "tool_choice": "auto",
    "stream": true
  }

  const response: any = await openai.chat.completions.create(params);
  // const response = await openai.chat.completions.create({
  //   model,
  //   stream: true,
  //   messages,
  //   tools,
  //   tool_choice: 'auto',
  // });

  const stream = OpenAIStream(response, {
    onCompletion(completion) {
      console.log('completion', completion);
    },
    onFinal(completion) {
    },
    onToken(token) {
      console.log('onToken', token);
    },
  });

  return new StreamingTextResponse(stream, {});
}
