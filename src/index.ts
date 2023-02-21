/**
 * https://elaws.e-gov.go.jp/file/houreiapi_shiyosyo.pdf
 * e-Gov 法令 API(Version 1)仕様書
 */

interface GetArticlesOption {
  /** 法令番号 */
  lawNum: string
  /** 法令 ID */
  lawId: string
  /** 条 */
  article: string
  /** 項 */
  paragraph: string
  /** 別表 */
  appdxTable: string
}
type 条を取得する場合 = Pick<GetArticlesOption, 'article'>
type 項を取得する場合 = Pick<GetArticlesOption, 'paragraph'>
type 条配下の項を取得する場合 = Pick<GetArticlesOption, 'article' | 'paragraph'>
type 別表を取得する場合 = Pick<GetArticlesOption, 'appdxTable'>
type Options =
  | 条を取得する場合
  | 項を取得する場合
  | 条配下の項を取得する場合
  | 別表を取得する場合

type R = Pick<GetArticlesOption, 'lawNum'> | Pick<GetArticlesOption, 'lawId'>

class ELaws {
  version = 1
  baseUrl = `https://elaws.e-gov.go.jp/api/${this.version}`
  parser = new DOMParser()

  /** 法令名一覧取得 */
  async getLawlists(法令種別: 法令種別.全法令): Promise<Lawlists> {
    const uri = this.baseUrl + `/lawlists/${法令種別}`
    const res = await this.request(uri)
    if (res.code !== 0) throw Error(res.message)
    return Lawlists.fromElement(res.data)
  }

  /** 法令取得 */
  async getLawdata(法令番号: string): Promise<Lawdata>
  async getLawdata(法令ID: string): Promise<Lawdata>
  async getLawdata(id: string): Promise<Lawdata> {
    const uri = this.baseUrl + `/lawdata/${id}`
    const res = await this.request(uri)
    if (res.code !== 0) throw Error(res.message)
    return Lawdata.fromElement(res.data)
  }

  /**
   * 条文内容取得
   *
   * 補足事項
   * - 法令番号が重複している法令は、条文内容取得 API で{法令番号}をパラメータに指定して取得
   *   することができません。ただし、これらの法令は条文内容取得 API を実行するとき、{法令
   *   ID}をパラメータに指定することで取得できます。また、該当法令の条文画面、検索結果一覧
   *   等からも XML ファイルを取得することができます。
   * - 条文内容取得 API にて URI パラメータに指定する別表名が長すぎる場合、「Request
   *   Rejected」というエラーの HTML を返却することがあります。別表名は前方一致により検索を
   *   行いますので、このエラーHTML が返却された場合は、URI パラメータに指定する別表名を短縮
   *   のうえ、再度条文内容取得 API を実行してください。「Request Rejected」については「5.2
   *   「Request Rejected」の HTML が応答される場合について」を参照してください。
   */
  async getArticles(params: R & Options): Promise<Articles> {
    const p = Object.entries(params).map(([k, v]) => `${k}=${v}`)
    const uri = this.baseUrl + `/articles;${p.join(';')}`
    // @todo: 300
    const res = await this.request(uri)
    if (res.code !== 0 && res.code !== 2) throw Error(res.message)
    return Articles.fromElement(res.data)
  }

  /** 更新法令一覧取得 */
  async getUpdatelawlists(date: Date): Promise<Updatelawlists> {
    const min = new Date('2020-11-24T00:00:00.000+09:00')
    if (date < min)
      throw RangeError('指定可能な年月日は 2020 年 11 月 24 日以降です。')
    if (date > new Date()) throw RangeError('未来の日付は指定できません。')
    const yyyy = date.getFullYear()
    const MM = ('00' + (date.getMonth() + 1)).slice(-2)
    const dd = ('00' + date.getDate()).slice(-2)
    const uri = this.baseUrl + `/updatelawlists/${yyyy}${MM}${dd}`
    const res = await this.request(uri)
    if (res.code !== 0) throw Error(res.message)
    return Updatelawlists.fromElement(res.data)
  }

  parseXML(xml: string): XMLDocument {
    const doc = this.parser.parseFromString(xml, 'application/xml')
    const err = doc.querySelector('parsererror')
    if (err) throw err
    return doc
  }

  async request(url: string): Promise<Result & { data: Element }> {
    const res = await fetch(url)
    if (!res.ok) throw res
    const xml = await res.text()
    const doc = this.parseXML(xml)
    return {
      ...Result.fromElement(doc.querySelector('DataRoot Result')),
      data: doc.querySelector('DataRoot ApplData'),
    }
  }
}

/** 処理結果項目 */
class Result {
  code: 処理結果コード
  message: string

  static fromElement(result: Element): Result {
    const v = new Result()
    v.code = parseInt(result.querySelector('Code').textContent)
    v.message = result.querySelector('Message').textContent
    return v
  }
}

class Lawlists {
  Category: 法令種別
  LawNameListInfo: LawNameListInfo[]

  static fromElement(e: Element): Lawlists {
    const v = new Lawlists()
    v.Category = parseInt(e.querySelector('Category').textContent)
    const infos = Array.from(e.querySelectorAll('LawNameListInfo'))
    v.LawNameListInfo = infos.map((v) => LawNameListInfo.fromElement(v))
    return v
  }
}

/** 取得要求した法令種別に合致する法令名一覧情報 */
class LawNameListInfo {
  LawId: string
  LawName: string
  LawNo: string
  PromulgationDate: Date

  static fromElement(info: Element): LawNameListInfo {
    const v = new LawNameListInfo()
    v.LawId = info.querySelector('LawId').textContent
    v.LawName = info.querySelector('LawName').textContent
    v.LawNo = info.querySelector('LawNo').textContent
    const d = info.querySelector('PromulgationDate').textContent
    v.PromulgationDate = new Date(
      `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00.000+09:00`
    )
    return v
  }
}

class Lawdata {
  /** 取得要求した法令 ID  */
  LawId: string
  /** 取得要求した法令番号 */
  LawNum: string
  /** 取得要求した法令番号に合致する該当法令の全文 */
  LawFullText: string
  /** 画像情報（画像情報をフォルダ名 pict に収集し、フォルダ毎 ZIP 形式で圧縮したファイルを Base64 でエンコードした値） */
  ImageData?: string

  static fromElement(e: Element): Lawdata {
    const v = new Lawdata()
    v.LawId = e.querySelector('LawId').textContent
    v.LawNum = e.querySelector('LawNum').textContent
    v.LawFullText = e.querySelector('LawFullText').textContent
    // ※法令の全文に画像を含む場合、タグを出力する。上記以外はタグを出力しない。
    v.ImageData = e.querySelector('ImageData')?.textContent
    return v
  }
}

class Articles {
  /** 取得要求した法令 ID  */
  LawId: string
  /** 取得要求した法令番号 */
  LawNum: string
  /** 取得要求した条 */
  Article: string
  /** 取得要求した項 */
  Paragraph: string
  /** 取得要求した別表 */
  AppdxTable: string
  /** 取得要求した条件（法令番号、条、項又は別表）に合致する法令の該当条文の内容 */
  LawContents: string
  /** 取得要求した条件（別表）に合致する別表名の候補リスト */
  AppdxTableTitleLists?: {
    /** 取得要求した条件（別表）に合致した別表名の候補 */
    AppdxTableTitle: string[]
  }
  /** 画像情報（画像情報をフォルダ名 pict に収集し、フォルダ毎 ZIP 形式で圧縮したファイルを Base64 でエンコードした値） */
  ImageData?: string

  static fromElement(e: Element): Articles {
    const v = new Articles()
    v.LawId = e.querySelector('LawId').textContent
    v.LawNum = e.querySelector('LawNum').textContent

    v.Article = e.querySelector('Article').textContent
    v.Paragraph = e.querySelector('Paragraph').textContent
    v.AppdxTable = e.querySelector('AppdxTable').textContent
    v.LawContents = e.querySelector('LawContents').textContent

    const a = e.querySelector('AppdxTableTitleLists')
    if (a) {
      const titles = Array.from(a.querySelectorAll('AppdxTableTitle'))
      v.AppdxTableTitleLists = {
        AppdxTableTitle: titles.map((v) => v.textContent),
      }
    }

    // ※法令の該当条文の内容に画像を含む場合、タグを出力する。上記以外はタグを出力しない。
    v.ImageData = e.querySelector('ImageData')?.textContent
    return v
  }
}

class Updatelawlists {
  /** 取得要求した年月日 */
  Date: 法令種別
  /** 取得要求した更新日に合致する法令名一覧情報 */
  LawNameListInfo?: LawNameListInfo2[]

  static fromElement(e: Element): Updatelawlists {
    const v = new Updatelawlists()
    v.Date = parseInt(e.querySelector('Date').textContent)
    const infos = Array.from(e.querySelectorAll('LawNameListInfo'))
    v.LawNameListInfo = infos.map((v) => LawNameListInfo2.fromElement(v))
    return v
  }
}

enum EnforcementFlg {
  施行済 = 0,
  未施行 = 1,
}

enum AuthFlg {
  確認済 = 0,
  確認中 = 1,
}

/** 取得要求した更新日に合致する法令名一覧情報 */
class LawNameListInfo2 {
  /** 法令種別 */
  LawTypeName: 法令種別
  /** 法令番号 */
  LawNo: string
  /** 法令名称 */
  LawName: string
  /** 法令名読み */
  LawNameKana: string
  /** 旧法令名 */
  OldLawName: string
  /** 公布年月日 */
  PromulgationDate: Date
  /** 改正法令名 */
  AmendName: string
  /** 改正法令番号 */
  AmendNo: string
  /** 改正法令公布日 */
  AmendPromulgationDate: string
  /** 施行日 */
  EnforcementDate: string
  /** 施行日備考 */
  EnforcementComment: string
  /** 法令 ID */
  LawId: string
  /** 本文 URL */
  LawUrl: string
  /** 未施行 */
  EnforcementFlg: EnforcementFlg
  /** 所管課確認中 */
  AuthFlg: AuthFlg

  static fromElement(info: Element): LawNameListInfo2 {
    const v = new LawNameListInfo2()
    v.LawTypeName = parseInt(info.querySelector('LawTypeName').textContent)
    v.LawNo = info.querySelector('LawNo').textContent
    v.LawName = info.querySelector('LawName').textContent
    v.LawNameKana = info.querySelector('LawNameKana').textContent
    v.OldLawName = info.querySelector('OldLawName').textContent
    const d = info.querySelector('PromulgationDate').textContent
    v.PromulgationDate = new Date(
      `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00.000+09:00`
    )
    v.AmendName = info.querySelector('AmendName').textContent
    v.AmendNo = info.querySelector('AmendNo').textContent
    v.AmendPromulgationDate = info.querySelector(
      'AmendPromulgationDate'
    ).textContent
    v.EnforcementDate = info.querySelector('EnforcementDate').textContent
    v.EnforcementComment = info.querySelector('EnforcementComment').textContent
    v.LawId = info.querySelector('LawId').textContent
    v.LawUrl = info.querySelector('LawUrl').textContent
    v.EnforcementFlg = parseInt(
      info.querySelector('EnforcementFlg').textContent
    )
    v.AuthFlg = parseInt(info.querySelector('AuthFlg').textContent)
    return v
  }
}

/** 処理結果コードは、応答結果 XML の Code 項目に設定する値です。 */
enum 処理結果コード {
  '正常' = 0,
  /** 取得件数が 0 件の場合、及びパラメータ指定された法令番号等に該当する法令データが複数存在する場合も当該コード値が設定されます。 */
  'エラー' = 1,
  /** 条文内容取得 API の別表を取得する場合で、複数の候補がある場合に設定されます。 */
  '複数候補あり' = 2,
}

/** 法令種別は、法令名一覧取得 API のパラメータ｛法令種別｝に設定する値です。 */
enum 法令種別 {
  /** 法令名一覧取得 API のパラメータとして、全法令の一覧を取得する場合に設定します。 */
  '全法令' = 1,
  /** 法令名一覧取得 API のパラメータとして、憲法・法律の一覧を取得する場合に設定します。 */
  '憲法・法律' = 2,
  /** 法令名一覧取得 API のパラメータとして、政令・勅令の一覧を取得する場合に設定します。 */
  '政令・勅令' = 3,
  /** 法令名一覧取得 API のパラメータとして、府省令・規則の一覧を取得する場合に設定します。 */
  '府省令・規則' = 4,
}
