import axios from 'axios';

class EmailService {
  constructor(provider = 'mailinator') {
    this.provider = provider;
  }

  async createInbox() {
    switch (this.provider) {
      case 'mailinator':
        return this.createMailinatorInbox();
      case 'tempmail':
        return this.createTempMailInbox();
      case 'guerrillamail':
        return this.createGuerrillaMailInbox();
      default:
        return this.createMailinatorInbox();
    }
  }

  async createMailinatorInbox() {
    const inboxName = `tiktok_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const email = `${inboxName}@mailinator.com`;
    
    return {
      email,
      inboxName,
      checkUrl: `https://www.mailinator.com/api/v2/ inbox/${inboxName}/messages`,
      pollInterval: 3000
    };
  }

  async createTempMailInbox() {
    try {
      const response = await axios.get('https://api.temp-mail.org/request/domains/format/json');
      const domain = response.data[0];
      const prefix = `tiktok${Date.now()}`;
      const email = `${prefix}@${domain}`;
      
      return {
        email,
        prefix,
        domain,
        checkUrl: `https://api.temp-mail.org/request/mail/id/${prefix}`,
        pollInterval: 5000
      };
    } catch (err) {
      throw new Error('TempMail API failed: ' + err.message);
    }
  }

  async createGuerrillaMailInbox() {
    try {
      const response = await axios.get('https://api.guerrillamail.com/email/gen_random');
      const email = response.data.email_addr;
      const token = response.data.guid;
      
      return {
        email,
        token,
        checkUrl: `https://api.guerrillamail.com/ajax.php?f=check_email&email=${email}&seq=0`,
        pollInterval: 5000
      };
    } catch (err) {
      throw new Error('GuerrillaMail API failed: ' + err.message);
    }
  }

  async checkInbox(inbox) {
    switch (this.provider) {
      case 'mailinator':
        return this.checkMailinator(inbox);
      case 'tempmail':
        return this.checkTempMail(inbox);
      case 'guerrillamail':
        return this.checkGuerrillaMail(inbox);
      default:
        return this.checkMailinator(inbox);
    }
  }

  async checkMailinator(inbox) {
    try {
      const response = await axios.get(
        `https://www.mailinator.com/api/v2/inbox/${inbox.inboxName}?token=${process.env.MAILINATOR_TOKEN || ''}`
      );
      return response.data.msgs || [];
    } catch {
      return [];
    }
  }

  async checkTempMail(inbox) {
    try {
      const response = await axios.get(`https://api.temp-mail.org/request/mail/id/${inbox.prefix}/format/json`);
      return response.data || [];
    } catch {
      return [];
    }
  }

  async checkGuerrillaMail(inbox) {
    try {
      const response = await axios.get(
        `https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&token=${inbox.token}`
      );
      return response.data.list || [];
    } catch {
      return [];
    }
  }

  extractVerificationCode(emails, targetSubject = 'TikTok') {
    for (const email of emails) {
      const subject = email.subject || email.mail_subject || '';
      const body = email.body || email.mail_text || email.mail_preview || '';
      
      if (subject.toLowerCase().includes('tiktok') || subject.includes('Verify')) {
        // 尝试从多种格式中提取验证码
        const patterns = [
          /(\d{4,8})/,           // 4-8位数字
          /code[:\s]*(\d+)/i,    // code: 123456
          /verification[:\s]*(\d+)/i,
          /确认码[：:]?\s*(\d+)/i,
          /验证码[：:]?\s*(\d+)/i
        ];
        
        for (const pattern of patterns) {
          const match = body.match(pattern) || subject.match(pattern);
          if (match && match[1]) {
            return { code: match[1], email, subject };
          }
        }
      }
    }
    return null;
  }
}

export default EmailService;
